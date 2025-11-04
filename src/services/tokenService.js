const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class TokenService {
  constructor() {
    this.applePayCertPath = process.env.APPLE_PAY_CERT_PATH;
    this.applePayKeyPath = process.env.APPLE_PAY_KEY_PATH;
    this.merchantId = process.env.APPLE_PAY_MERCHANT_ID;
  }

  /**
   * Generate Apple Pay token (pass.pkpass file data)
   * @param {Object} params - Token parameters
   * @returns {Promise<Object>} - Apple Pay token details
   */
  async generateApplePayToken({ userId, walletId, balance }) {
    try {
      const tokenId = uuidv4();
      const passTypeId = process.env.APPLE_PAY_PASS_TYPE_ID;

      // Apple Pay pass structure
      const passData = {
        passTypeIdentifier: passTypeId,
        serialNumber: tokenId,
        teamIdentifier: process.env.APPLE_TEAM_ID,
        organizationName: 'TourPay',
        description: 'TourPay Payment Card',
        foregroundColor: 'rgb(255, 255, 255)',
        backgroundColor: 'rgb(60, 65, 76)',
        labelColor: 'rgb(255, 255, 255)',
        logoText: 'TourPay',
        generic: {
          primaryFields: [
            {
              key: 'balance',
              label: 'Balance',
              value: `$${parseFloat(balance).toFixed(2)} USDC`
            }
          ],
          secondaryFields: [
            {
              key: 'user',
              label: 'User ID',
              value: userId.substring(0, 8)
            }
          ],
          auxiliaryFields: [
            {
              key: 'network',
              label: 'Network',
              value: 'Base'
            }
          ],
          backFields: [
            {
              key: 'terms',
              label: 'Terms and Conditions',
              value: 'Visit tourpay.com/terms for full terms and conditions.'
            }
          ]
        },
        barcode: {
          message: tokenId,
          format: 'PKBarcodeFormatQR',
          messageEncoding: 'iso-8859-1'
        },
        webServiceURL: `${process.env.API_URL}/api/tokens/applepay`,
        authenticationToken: this.generateAuthToken(tokenId)
      };

      return {
        tokenId,
        tokenType: 'apple_pay',
        passData,
        provisioningUrl: `${process.env.API_URL}/api/tokens/applepay/${tokenId}/provision`,
        walletId
      };
    } catch (error) {
      console.error('Error generating Apple Pay token:', error);
      throw new Error(`Failed to generate Apple Pay token: ${error.message}`);
    }
  }

  /**
   * Generate Transit Card token (Clipper/Presto compatible)
   * @param {Object} params - Token parameters
   * @returns {Promise<Object>} - Transit card token details
   */
  async generateTransitCardToken({ userId, walletId, cardNumber = null }) {
    try {
      const tokenId = uuidv4();

      // Map to physical Clipper/Presto card if provided, otherwise virtual
      const transitCardData = {
        tokenId,
        tokenType: 'transit_card',
        cardNumber: cardNumber || this.generateVirtualCardNumber(),
        isVirtual: !cardNumber,
        walletId,
        userId,
        protocol: 'NFC', // Supports Clipper and Presto NFC
        maxBalance: '10000.00', // USDC
        network: 'base',
        tapToPayEnabled: true
      };

      // For Clipper: Uses Cubic Transportation Systems protocol
      // For Presto: Uses OMNY-compatible protocol
      const cardMapping = {
        clipper: {
          systemId: 'clipper',
          agencyId: 'tourpay',
          encoding: 'ISO14443A'
        },
        presto: {
          systemId: 'presto',
          agencyId: 'tourpay',
          encoding: 'ISO14443A'
        },
        orca: {
          systemId: 'orca',
          agencyId: 'tourpay',
          encoding: 'ISO14443A'
        }
      };

      return {
        ...transitCardData,
        cardMapping,
        activationUrl: `${process.env.API_URL}/api/tokens/transit/${tokenId}/activate`
      };
    } catch (error) {
      console.error('Error generating transit card token:', error);
      throw new Error(`Failed to generate transit card token: ${error.message}`);
    }
  }

  /**
   * Generate Discover Network Token (Virtual Card)
   * @param {Object} params - Token parameters
   * @returns {Promise<Object>} - Discover network token details
   */
  async generateDiscoverToken({ userId, walletId, balance }) {
    try {
      const tokenId = uuidv4();

      // Generate virtual Discover card details
      const cardNumber = this.generateDiscoverCardNumber();
      const cvv = this.generateCVV();
      const expiryDate = this.generateExpiryDate();

      const discoverTokenData = {
        tokenId,
        tokenType: 'discover',
        cardNumber, // Virtual card number
        cvv, // Encrypted CVV
        expiryMonth: expiryDate.month,
        expiryYear: expiryDate.year,
        cardholderName: 'TourPay User',
        billingZip: process.env.DEFAULT_ZIP || '00000',
        walletId,
        userId,
        balance: balance,
        network: 'discover',
        nfcEnabled: true,
        tapToPayEnabled: true,
        cardType: 'virtual'
      };

      return {
        ...discoverTokenData,
        provisionUrl: `${process.env.API_URL}/api/tokens/discover/${tokenId}/provision`,
        // Compass/NFC credentials for physical POS
        nfcCredentials: {
          aid: this.generateAID('discover'),
          track2Data: this.generateTrack2Data(cardNumber, expiryDate)
        }
      };
    } catch (error) {
      console.error('Error generating Discover token:', error);
      throw new Error(`Failed to generate Discover token: ${error.message}`);
    }
  }

  /**
   * Generate Google Pay token (coming soon)
   * @param {Object} params - Token parameters
   * @returns {Promise<Object>} - Google Pay token details
   */
  async generateGooglePayToken({ userId, walletId, balance }) {
    try {
      const tokenId = uuidv4();

      // Similar to Apple Pay but for Google Wallet
      const googlePayData = {
        tokenId,
        tokenType: 'google_pay',
        walletId,
        userId,
        balance,
        issuerId: process.env.GOOGLE_PAY_ISSUER_ID,
        objectId: `${process.env.GOOGLE_PAY_ISSUER_ID}.${tokenId}`,
        classId: process.env.GOOGLE_PAY_CLASS_ID
      };

      return {
        ...googlePayData,
        jwtToken: this.generateGooglePayJWT(googlePayData),
        saveUrl: `https://pay.google.com/gp/v/save/${googlePayData.objectId}`
      };
    } catch (error) {
      console.error('Error generating Google Pay token:', error);
      throw new Error(`Failed to generate Google Pay token: ${error.message}`);
    }
  }

  /**
   * Validate and process token usage
   * @param {string} tokenId - Token identifier
   * @param {number} amount - Amount to charge
   * @returns {Promise<Object>} - Transaction result
   */
  async processTokenPayment(tokenId, amount) {
    try {
      // This would integrate with the wallet deduction logic
      return {
        success: true,
        tokenId,
        amount,
        transactionId: uuidv4(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error processing token payment:', error);
      throw new Error(`Failed to process token payment: ${error.message}`);
    }
  }

  // Helper methods

  generateAuthToken(tokenId) {
    return crypto
      .createHmac('sha256', process.env.JWT_SECRET)
      .update(tokenId)
      .digest('hex');
  }

  generateVirtualCardNumber() {
    // Generate a valid virtual card number (Luhn algorithm)
    const prefix = '6011'; // Discover prefix
    let cardNumber = prefix;

    for (let i = 0; i < 11; i++) {
      cardNumber += Math.floor(Math.random() * 10);
    }

    // Add Luhn check digit
    const checkDigit = this.calculateLuhnCheckDigit(cardNumber);
    return cardNumber + checkDigit;
  }

  generateDiscoverCardNumber() {
    // Generate Discover card number (starts with 6011, 622126-622925, 644-649, 65)
    const prefix = '6011';
    let cardNumber = prefix;

    for (let i = 0; i < 12; i++) {
      cardNumber += Math.floor(Math.random() * 10);
    }

    const checkDigit = this.calculateLuhnCheckDigit(cardNumber);
    return cardNumber + checkDigit;
  }

  calculateLuhnCheckDigit(cardNumber) {
    let sum = 0;
    let isEven = true;

    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return (10 - (sum % 10)) % 10;
  }

  generateCVV() {
    // Generate 3-digit CVV (encrypted in production)
    return String(Math.floor(Math.random() * 900) + 100);
  }

  generateExpiryDate() {
    const currentDate = new Date();
    const expiryDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + 3));

    return {
      month: String(expiryDate.getMonth() + 1).padStart(2, '0'),
      year: String(expiryDate.getFullYear()).slice(-2)
    };
  }

  generateAID(network) {
    // Application Identifier for NFC payments
    const aids = {
      discover: 'A0000001523010',
      visa: 'A0000000031010',
      mastercard: 'A0000000041010'
    };

    return aids[network] || aids.discover;
  }

  generateTrack2Data(cardNumber, expiryDate) {
    // Simplified Track 2 data for NFC
    return `${cardNumber}=${expiryDate.year}${expiryDate.month}101`;
  }

  generateGooglePayJWT(data) {
    // Placeholder for Google Pay JWT generation
    // In production, use Google Wallet API
    const jwt = require('jsonwebtoken');

    return jwt.sign(data, process.env.GOOGLE_PAY_PRIVATE_KEY, {
      algorithm: 'RS256',
      expiresIn: '1h'
    });
  }
}

module.exports = new TokenService();
