"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const openai_1 = __importStar(require("openai"));
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
            const messages1 = [];
            if (n.tools && n.tools.length > 0) {
                const tools = await Promise.all(n.tools.map(async (it) => {
                    var _a;
                    let url = await evaluateNodeProperty(it.name, it.nameType, node, msg);
                    const segs = url.split('/');
                    const name = segs.pop();
                    if (segs[0] === '') {
                        segs.shift();
                    }
                    if (segs.length === 0) {
                        url = `http://localhost:${(_a = process.env.PORT) !== null && _a !== void 0 ? _a : '1880'}/${name}`;
                    }
                    const description = await evaluateNodeProperty(it.description, it.descriptionType, node, msg);
                    const schema = await evaluateNodeProperty(it.schema, it.schemaType, node, msg);
                    const options = await evaluateNodeProperty(it.options, it.optionsType, node, msg);
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
                            function: async (args, runner) => {
                                if (name === '__structured_output__') {
                                    runner.abort();
                                    msg.payload = args;
                                    return args;
                                }
                                else {
                                    try {
                                        const response = await fetch(url, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify(args),
                                            ...options
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
                    const runner = client.beta.chat.completions
                        .runTools({
                        model: n.model,
                        messages,
                        tools,
                    })
                        .on('message', (message) => {
                        node.log(`message: ${(0, util_1.inspect)(message, false, 10)}`);
                        messages1.push(message);
                    });
                    const finalContent = await runner.finalContent();
                    msg.payload = finalContent;
                    msg.messages = messages1;
                    send(msg);
                    done();
                }
                catch (error) {
                    if (error instanceof openai_1.APIUserAbortError) {
                        // msg.payload has been set before aborted
                        msg.messages = messages1;
                        send(msg);
                        done();
                    }
                    else {
                        node.error(`error ${error}`);
                        done(error);
                    }
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
