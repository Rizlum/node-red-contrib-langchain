"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const openai_1 = __importDefault(require("openai"));
const ajv_1 = __importDefault(require("ajv"));
const util_1 = require("util");
const LangchainChatNodeInitializer = (RED) => {
    const evaluateNodeProperty = (0, util_1.promisify)(RED.util.evaluateNodeProperty);
    function LangchainChatNode(n) {
        RED.nodes.createNode(this, n);
        this.config = RED.nodes.getNode(n.config);
        const node = this;
        node.on("input", async (msg, send, done) => {
            const { url, apiKey } = node.config;
            const customOptions = await evaluateNodeProperty(n.customOptions, n.customOptionsType, node, msg);
            const client = new openai_1.default({
                baseURL: url,
                apiKey: apiKey,
                ...customOptions
            });
            const messages = await evaluateNodeProperty(n.messages, n.messagesType, node, msg);
            if (n.tools && n.tools.length > 0) {
                const tools = await Promise.all(n.tools.map(async (it) => {
                    const url = await evaluateNodeProperty(it.name, it.nameType, node, msg);
                    const segs = url.split('/');
                    const name = segs[segs.length - 1];
                    const description = await evaluateNodeProperty(it.description, it.descriptionType, node, msg);
                    const schema = await evaluateNodeProperty(it.schema, it.schemaType, node, msg);
                    return {
                        type: 'function',
                        function: {
                            parse: (args) => {
                                const data = JSON.parse(args);
                                const ajv = new ajv_1.default();
                                const valid = ajv.validate(schema, data);
                                if (!valid) {
                                    const error = new Error(ajv.errors.map(it => `${it}`).join('\n'));
                                    error.name = 'ParsedError';
                                    throw error;
                                }
                                return data;
                            },
                            function: async (args) => {
                                if (name === '__structured_output__') {
                                    return args;
                                }
                                try {
                                    const response = await fetch(url, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify(args)
                                    });
                                    const text = await response.text();
                                    try {
                                        const json = JSON.parse(text);
                                        return json;
                                    }
                                    catch (error) {
                                        return text;
                                    }
                                }
                                catch (error) {
                                    return error;
                                }
                            },
                            name,
                            description,
                            parameters: schema,
                        },
                    };
                }));
                node.log(`runTool: ${(0, util_1.inspect)({
                    model: n.model,
                    messages,
                    tools,
                }, false, 10)})`);
                try {
                    const messages1 = [];
                    const runner = client.beta.chat.completions
                        .runTools({
                        model: n.model,
                        messages,
                        tools,
                    })
                        .on('message', (message) => {
                        node.log(`message: ${message}`);
                        messages1.push(message);
                    });
                    const finalContent = await runner.finalContent();
                    msg.payload = finalContent;
                    msg.messages = messages1;
                    send(msg);
                    done();
                }
                catch (error) {
                    node.error(`error ${error}`);
                    done(error);
                }
            }
            else {
                try {
                    const chatCompletion = await client.chat.completions.create({
                        model: n.model,
                        messages,
                    });
                    msg.payload = chatCompletion.choices[0].message.content;
                    msg.messages = [...messages, chatCompletion.choices[0].message];
                    send(msg);
                    done();
                }
                catch (error) {
                    node.error(`error ${error}`);
                    done(error);
                }
            }
        });
    }
    RED.nodes.registerType("openai-chat", LangchainChatNode);
};
module.exports = LangchainChatNodeInitializer;
