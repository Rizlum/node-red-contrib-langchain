"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const openai_1 = __importDefault(require("openai"));
const util_1 = require("util");
const LangchainChatNodeInitializer = (RED) => {
    const evaluateNodeProperty = (0, util_1.promisify)(RED.util.evaluateNodeProperty);
    function LangchainChatNode(n) {
        RED.nodes.createNode(this, n);
        this.config = RED.nodes.getNode(n.config);
        const node = this;
        node.on("input", async (msg, send, done) => {
            const { url, apiKey } = this.config;
            const customOptions = await evaluateNodeProperty(n.customOptions, n.customOptionsType, node, msg);
            const client = new openai_1.default({
                baseURL: url,
                apiKey: apiKey,
                ...customOptions
            });
            const messages = await evaluateNodeProperty(n.messages, n.messagesType, node, msg);
            try {
                const chatCompletion = await client.chat.completions.create({
                    model: n.model,
                    messages,
                });
                send(chatCompletion.choices[0].message);
                done();
            }
            catch (error) {
                node.error(`error ${error}`);
                done(error);
            }
        });
    }
    RED.nodes.registerType("openai-chat", LangchainChatNode);
};
module.exports = LangchainChatNodeInitializer;
