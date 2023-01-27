/* eslint-disable linebreak-style */
'use strict';

var AbstractRequest = require('*/cartridge/scripts/dto/base/abstractRequest');
var AbstractResponse = require('*/cartridge/scripts/dto/base/abstractResponse');
var Card = require('*/cartridge/scripts/dto/paymentMethods/card');
var Action = require('*/cartridge/scripts/dto/nested/action');

/**
 * Forms all the fields required to send for PaymentToken request.
 * @param {obj} requestObj - object that contains fields for request to be sent.
 */
var PaymentTokenRequest = AbstractRequest.extend({
    init: function (requestObj) {
        Object.defineProperties(this, {
            // add more fields as per the Model here:
            usage_mode: {
                enumerable: true,
                writable: true
            },
            reference: {
                enumerable: true,
                writable: true
            },
            first_name: {
                enumerable: true,
                writable: true
            },
            last_name: {
                enumerable: true,
                writable: true
            },
            entry_mode: {
                enumerable: true,
                writable: true
            },
            card: AbstractResponse.getAccessorDescriptorWithConstructor(Card.Request)
            // add more here later
        });

        this._super(requestObj);
    },
    getEndpoint: function () {
        return 'payment-methods';
    },

    getHttpMethod: function () {
        return 'POST';
    }
});
/**
 * Forms all fields to be Returned as part of DigitalWallet response.
 * @param {obj} responseObj - object that contains fields from response.
 */
var PaymentTokenResponse = AbstractResponse.extend({
    init: function (responseObj) {
        Object.defineProperties(this, {
            id: {
                enumerable: true,
                writable: true
            },
            status: {
                enumerable: true,
                writable: true
            },
            action: AbstractResponse.getAccessorDescriptorWithConstructor(Action.Response)
        });

        this._super(responseObj);
    }
});
module.exports = {
    Request: PaymentTokenRequest,
    Response: PaymentTokenResponse
};
