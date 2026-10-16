const express = require("express");
const axios = require("axios");

const router = express.Router();

const PAYHERO_BASE_URL = "https://backend.payhero.co.ke/api/v2";

const {
    PAYHERO_API_USERNAME,
    PAYHERO_API_PASSWORD,
    PAYHERO_CHANNEL_ID
} = process.env;

if (!PAYHERO_API_USERNAME || !PAYHERO_API_PASSWORD || !PAYHERO_CHANNEL_ID) {
    console.warn("⚠️ PayHero credentials missing. Set PAYHERO_API_USERNAME, PAYHERO_API_PASSWORD and PAYHERO_CHANNEL_ID in .env");
}

// Basic phone sanity check: 2547XXXXXXXX or 2541XXXXXXXX
function isValidKenyanPhone(phone) {
    return typeof phone === "string" && /^254(7|1)\d{8}$/.test(phone);
}

router.post("/stk-push", async(req, res) => {
    try {
        const { phone_number, amount } = req.body;

        if (!phone_number || !amount) {
            return res.status(400).json({
                success: false,
                message: "Phone number and amount are required"
            });
        }

        const phone = String(phone_number).replace(/\D/g, "");
        if (!isValidKenyanPhone(phone)) {
            return res.status(400).json({
                success: false,
                message: "Invalid phone number. Use format 2547XXXXXXXX or 2541XXXXXXXX."
            });
        }

        const numericAmount = Number(amount);
        if (!Number.isInteger(numericAmount) || numericAmount < 1) {
            return res.status(400).json({
                success: false,
                message: "Amount must be a positive whole number (KES)."
            });
        }

        const externalReference = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

        const payload = {
            amount: numericAmount,
            phone_number: phone,
            channel_id: PAYHERO_CHANNEL_ID,
            provider: "m-pesa",
            external_reference: externalReference,
            callback_url: process.env.PAYHERO_CALLBACK_URL || "https://yourdomain.com/api/payhero-callback",
            metadata: {
                source: "crashgame-web-deposit"
            }
        };

        const response = await axios.post(
            `${PAYHERO_BASE_URL}/payments`,
            payload, {
                auth: {
                    username: PAYHERO_API_USERNAME,
                    password: PAYHERO_API_PASSWORD
                },
                timeout: 30000
            }
        );

        console.log(`STK push queued | ref=${externalReference} | phone=${phone} | amount=${numericAmount}`);

        return res.json({
            success: true,
            message: "STK Push sent successfully. Check your phone and enter your M-Pesa PIN.",
            data: {
                external_reference: externalReference,
                order_tracking_id: response.data.order_tracking_id || null,
                status: response.data.status || "PENDING"
            }
        });

    } catch (error) {
        const status = error.response ? error.response.status : 500;
        const errorMessage =
            error.response &&
            error.response.data &&
            (error.response.data.message || error.response.data.errorMessage);

        console.error("STK ERROR:", errorMessage || error.message);

        return res.status(status === 400 ? 400 : 500).json({
            success: false,
            message: errorMessage || "Payment initiation failed"
        });
    }
});

router.post("/payhero-callback", async(req, res) => {
    console.log("PayHero Callback:", JSON.stringify(req.body));

    try {
        const callback = req.body;
        const response = callback.ResponseCode !== undefined ? callback : (callback.Body && callback.Body.stkCallback) || callback;

        // TODO: Locate transaction by external_reference and credit the user's balance here if successful

        res.sendStatus(200);
    } catch (err) {
        console.error("Callback processing error:", err.message);
        res.sendStatus(200);
    }
});

module.exports = router;