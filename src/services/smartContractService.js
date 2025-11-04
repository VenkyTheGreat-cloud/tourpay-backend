const { ethers } = require('ethers');

class SmartContractService {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.escrowContract = null;
    this.initialized = false;
  }

  /**
   * Initialize the smart contract service
   */
  async initialize() {
    try {
      // Connect to Base network (Coinbase L2)
      const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
      this.provider = new ethers.JsonRpcProvider(rpcUrl);

      // Initialize wallet with private key
      const privateKey = process.env.ESCROW_WALLET_PRIVATE_KEY;
      this.wallet = new ethers.Wallet(privateKey, this.provider);

      // Initialize escrow contract
      const escrowContractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
      const escrowABI = this.getEscrowABI();
      this.escrowContract = new ethers.Contract(
        escrowContractAddress,
        escrowABI,
        this.wallet
      );

      this.initialized = true;
      console.log('Smart contract service initialized successfully');
    } catch (error) {
      console.error('Error initializing smart contract service:', error);
      throw new Error(`Failed to initialize smart contract service: ${error.message}`);
    }
  }

  /**
   * Create a booking with escrow smart contract
   * @param {Object} bookingData - Booking details
   * @returns {Promise<Object>} - Transaction details
   */
  async createBooking({
    bookingId,
    userId,
    tourOperatorAddress,
    amountUSDC,
    travelDate,
    cancellationDeadline
  }) {
    if (!this.initialized) await this.initialize();

    try {
      // Convert USDC amount to wei (6 decimals for USDC)
      const amountInWei = ethers.parseUnits(amountUSDC.toString(), 6);

      // Call smart contract createBooking function
      const tx = await this.escrowContract.createBooking(
        bookingId,
        userId,
        tourOperatorAddress,
        amountInWei,
        Math.floor(new Date(travelDate).getTime() / 1000),
        Math.floor(new Date(cancellationDeadline).getTime() / 1000)
      );

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? 'success' : 'failed'
      };
    } catch (error) {
      console.error('Error creating booking on blockchain:', error);
      throw new Error(`Failed to create booking on blockchain: ${error.message}`);
    }
  }

  /**
   * Process payment and hold in escrow
   * @param {string} bookingId - Booking identifier
   * @param {string} userWalletAddress - User's wallet address
   * @param {string} amount - Amount in USDC
   * @returns {Promise<Object>} - Transaction details
   */
  async processPayment(bookingId, userWalletAddress, amount) {
    if (!this.initialized) await this.initialize();

    try {
      const amountInWei = ethers.parseUnits(amount.toString(), 6);

      const tx = await this.escrowContract.processPayment(
        bookingId,
        userWalletAddress,
        amountInWei
      );

      const receipt = await tx.wait();

      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'success' : 'failed'
      };
    } catch (error) {
      console.error('Error processing payment on blockchain:', error);
      throw new Error(`Failed to process payment on blockchain: ${error.message}`);
    }
  }

  /**
   * Release payment to tour operator after check-in
   * @param {string} bookingId - Booking identifier
   * @returns {Promise<Object>} - Transaction details
   */
  async releasePayment(bookingId) {
    if (!this.initialized) await this.initialize();

    try {
      const tx = await this.escrowContract.releasePayment(bookingId);
      const receipt = await tx.wait();

      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'success' : 'failed',
        released: true
      };
    } catch (error) {
      console.error('Error releasing payment on blockchain:', error);
      throw new Error(`Failed to release payment on blockchain: ${error.message}`);
    }
  }

  /**
   * Process refund if tour is cancelled
   * @param {string} bookingId - Booking identifier
   * @param {string} refundAmount - Amount to refund in USDC
   * @returns {Promise<Object>} - Transaction details
   */
  async processRefund(bookingId, refundAmount) {
    if (!this.initialized) await this.initialize();

    try {
      const amountInWei = ethers.parseUnits(refundAmount.toString(), 6);

      const tx = await this.escrowContract.processRefund(bookingId, amountInWei);
      const receipt = await tx.wait();

      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        refundAmount: refundAmount,
        status: receipt.status === 1 ? 'success' : 'failed'
      };
    } catch (error) {
      console.error('Error processing refund on blockchain:', error);
      throw new Error(`Failed to process refund on blockchain: ${error.message}`);
    }
  }

  /**
   * Get booking status from smart contract
   * @param {string} bookingId - Booking identifier
   * @returns {Promise<Object>} - Booking status
   */
  async getBookingStatus(bookingId) {
    if (!this.initialized) await this.initialize();

    try {
      const booking = await this.escrowContract.getBooking(bookingId);

      return {
        bookingId: booking.bookingId,
        userId: booking.userId,
        tourOperator: booking.tourOperator,
        amount: ethers.formatUnits(booking.amount, 6),
        status: this.mapBookingStatus(booking.status),
        travelDate: new Date(Number(booking.travelDate) * 1000),
        createdAt: new Date(Number(booking.createdAt) * 1000),
        isReleased: booking.isReleased,
        isRefunded: booking.isRefunded
      };
    } catch (error) {
      console.error('Error getting booking status from blockchain:', error);
      throw new Error(`Failed to get booking status from blockchain: ${error.message}`);
    }
  }

  /**
   * Get USDC contract instance
   * @returns {Contract} - USDC contract instance
   */
  getUSDCContract() {
    const usdcAddress = process.env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base mainnet USDC
    const usdcABI = [
      'function balanceOf(address owner) view returns (uint256)',
      'function transfer(address to, uint256 amount) returns (bool)',
      'function approve(address spender, uint256 amount) returns (bool)',
      'function allowance(address owner, address spender) view returns (uint256)'
    ];

    return new ethers.Contract(usdcAddress, usdcABI, this.wallet);
  }

  /**
   * Check USDC balance
   * @param {string} address - Wallet address
   * @returns {Promise<string>} - Balance in USDC
   */
  async checkUSDCBalance(address) {
    if (!this.initialized) await this.initialize();

    try {
      const usdcContract = this.getUSDCContract();
      const balance = await usdcContract.balanceOf(address);
      return ethers.formatUnits(balance, 6);
    } catch (error) {
      console.error('Error checking USDC balance:', error);
      throw new Error(`Failed to check USDC balance: ${error.message}`);
    }
  }

  /**
   * Map numeric status to string
   * @param {number} status - Numeric status code
   * @returns {string} - Status string
   */
  mapBookingStatus(status) {
    const statusMap = {
      0: 'pending',
      1: 'confirmed',
      2: 'checked_in',
      3: 'completed',
      4: 'cancelled',
      5: 'refunded'
    };

    return statusMap[status] || 'unknown';
  }

  /**
   * Get escrow contract ABI
   * @returns {Array} - Contract ABI
   */
  getEscrowABI() {
    return [
      'function createBooking(string bookingId, string userId, address tourOperator, uint256 amount, uint256 travelDate, uint256 cancellationDeadline) returns (bool)',
      'function processPayment(string bookingId, address userWallet, uint256 amount) returns (bool)',
      'function releasePayment(string bookingId) returns (bool)',
      'function processRefund(string bookingId, uint256 refundAmount) returns (bool)',
      'function getBooking(string bookingId) view returns (tuple(string bookingId, string userId, address tourOperator, uint256 amount, uint8 status, uint256 travelDate, uint256 createdAt, bool isReleased, bool isRefunded))',
      'event BookingCreated(string bookingId, string userId, address tourOperator, uint256 amount)',
      'event PaymentProcessed(string bookingId, uint256 amount)',
      'event PaymentReleased(string bookingId, address tourOperator, uint256 amount)',
      'event RefundProcessed(string bookingId, address user, uint256 refundAmount)'
    ];
  }

  /**
   * Listen for contract events
   * @param {string} eventName - Event name to listen for
   * @param {Function} callback - Callback function
   */
  async listenForEvent(eventName, callback) {
    if (!this.initialized) await this.initialize();

    try {
      this.escrowContract.on(eventName, (...args) => {
        callback(...args);
      });
    } catch (error) {
      console.error(`Error listening for event ${eventName}:`, error);
      throw new Error(`Failed to listen for event: ${error.message}`);
    }
  }

  /**
   * Send USDC to operator wallet
   * @param {string} operatorAddress - Operator's wallet address
   * @param {string} amount - Amount in USDC
   * @param {string} bookingId - Booking ID for tracking
   * @returns {Promise<Object>} - Transaction details
   */
  async sendUSDCToOperator(operatorAddress, amount, bookingId = null) {
    if (!this.initialized) await this.initialize();

    try {
      const usdcContract = this.getUSDCContract();
      const amountInWei = ethers.parseUnits(amount.toString(), 6);

      // Transfer USDC to operator
      const tx = await usdcContract.transfer(operatorAddress, amountInWei);
      const receipt = await tx.wait();

      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'success' : 'failed',
        amount: amount,
        operatorAddress: operatorAddress,
        bookingId: bookingId
      };
    } catch (error) {
      console.error('Error sending USDC to operator:', error);
      throw new Error(`Failed to send USDC to operator: ${error.message}`);
    }
  }

  /**
   * Get transaction status from blockchain
   * @param {string} txHash - Transaction hash
   * @returns {Promise<Object>} - Transaction status
   */
  async getTransactionStatus(txHash) {
    if (!this.initialized) await this.initialize();

    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return {
          status: 'pending',
          confirmations: 0
        };
      }

      return {
        status: receipt.status === 1 ? 'completed' : 'failed',
        blockNumber: receipt.blockNumber,
        confirmations: receipt.confirmations,
        gasUsed: receipt.gasUsed.toString(),
        transactionHash: receipt.hash
      };
    } catch (error) {
      console.error('Error getting transaction status:', error);
      throw new Error(`Failed to get transaction status: ${error.message}`);
    }
  }

  /**
   * Batch release payments to multiple operators
   * @param {Array} payouts - Array of payout objects {bookingId, operatorAddress, amount}
   * @returns {Promise<Array>} - Array of transaction results
   */
  async batchReleasePayments(payouts) {
    if (!this.initialized) await this.initialize();

    try {
      const results = [];

      for (const payout of payouts) {
        try {
          const result = await this.sendUSDCToOperator(
            payout.operatorAddress,
            payout.amount,
            payout.bookingId
          );
          results.push({
            bookingId: payout.bookingId,
            success: true,
            ...result
          });
        } catch (error) {
          results.push({
            bookingId: payout.bookingId,
            success: false,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error in batch release payments:', error);
      throw new Error(`Failed to batch release payments: ${error.message}`);
    }
  }
}

module.exports = new SmartContractService();
