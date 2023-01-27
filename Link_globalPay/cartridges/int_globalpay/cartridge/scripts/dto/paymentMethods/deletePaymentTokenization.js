/* eslint-disable linebreak-style */
'use strict';

var AbstractRequest = require('*/cartridge/scripts/dto/base/abstractRequest');
var AbstractResponse = require('*/cartridge/scripts/dto/base/abstractResponse');
var Action = require('*/cartridge/scripts/dto/nested/action');

/**
 * Forms all the fields required to send for DeletePaymentToken request.
 * @param {obj} requestObj - object that contains fields for request to be sent.
 */
var DeletePaymentTokenRequest = AbstractRequest.extend({
    init: function (requestObj) {
        Object.defineProperties(this, {
    // Add more fields as per the Model here
            cctokenId: {
                enumerable: true,
                writable: true
            }
        });

        this._super(requestObj);
    },

    getEndpoint: function () {
        return this.prepareEndpoint(
            'payment-methods/:cctokenId/detokenize',
            {cctokenId: this.cctokenId}
        );
    },

    getHttpMethod: function () {
        return 'POST';
    }
});
/**
 * Forms all fields to be Returned as part of DeletePaymentToken response.
 * @param {obj} responseObj - object that contains fields from response.
 */
var DeletePaymentTokenResponse = AbstractResponse.extend({
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
    Request: DeletePaymentTokenRequest,
    Response: DeletePaymentTokenResponse
};
