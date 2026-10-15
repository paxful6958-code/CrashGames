const express = require("express");
const axios = require("axios");

const router = express.Router();

const PAYHERO_BASE_URL = "https://backend.payhero.co.ke/api/v2";

const {
    PAYHERO_API_USERNAME,
    PAYHERO_API_PASSWORD,
    PAYHERO_CHANNEL_ID
} = process.env;

router.post("/stk-push", async(req, res) => {
    try {
        const { phone_number, amount } = req.body;

        if (!phone_number || !amount) {
            return res.status(400).json({
                success: false,
                message: "Phone number and amount are required"
            });
        }

        const payload = {
            amount,
            phone_number,
            channel_id: PAYHERO_CHANNEL_ID,
            provider: "m-pesa",
            external_reference: `TXN-${Date.now()}`,
            callback_url: "https://yourdomain.com/api/payhero-callback"
        };

        const response = await axios.post(
            `${PAYHERO_BASE_URL}/payments`,
            payload, {
                auth: {
                    username: PAYHERO_API_USERNAME,
                    password: PAYHERO_API_PASSWORD
                }
            }
        );

        return res.json({
            success: true,
            message: "STK Push sent successfully",
            data: response.data
        });

    } catch (error) {
        const errorMessage =
            error.response &&
            error.response.data &&
            error.response.data.message;

        console.error("STK ERROR:", errorMessage || error.message);

        return res.status(500).json({
            success: false,
            message: errorMessage || "Payment initiation failed"
        });
    }
});

router.post("/payhero-callback", async (req, res) => {
    console.log("PayHero Callback:", req.body);
    // Log the transaction result to your database
    res.sendStatus(200);
});

module.exports = router;