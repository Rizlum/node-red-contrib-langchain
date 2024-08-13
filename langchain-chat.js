"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const messages_1 = require("@langchain/core/messages");
const output_parsers_1 = require("@langchain/core/output_parsers");
const openai_1 = require("@langchain/openai");
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
            const customHeaders = await evaluateNodeProperty(n.customHeaders, n.customHeadersType, node, msg);
            const model = new openai_1.ChatOpenAI({
                model: n.model,
                apiKey,
                configuration: {
                    baseURL: url,
                    defaultHeaders: customHeaders
                },
                ...customOptions
            });
            const parser = new output_parsers_1.StringOutputParser();
            const chain = model.pipe(parser);
            const messages0 = await evaluateNodeProperty(n.messages, n.messagesType, node, msg);
            const messages = messages0.map((it) => {
                switch (it.role) {
                    case 'system': return new messages_1.SystemMessage(it.content); // FIXME(QL): Type, more complex messages
                    case 'assistant': return new messages_1.AIMessage(it.content);
                    case 'user': return new messages_1.HumanMessage(it.content);
                    default:
                        node.warn(`ignore message as its role is unknown '${it}'`);
                        return;
                }
            }).filter((it) => it);
            node.log(`messages ${messages}`);
            try {
                const result = await chain.invoke(messages);
                msg.payload = result;
                send(msg);
                done();
            }
            catch (error) {
                node.error(`error ${error}`);
                done(error);
            }
        });
    }
    RED.nodes.registerType("langchain-chat", LangchainChatNode);
};
module.exports = LangchainChatNodeInitializer;
