import { Node, NodeDef, NodeInitializer, NodeMessage } from "node-red";
import { LangChainConfigNodeDef } from "./langchain-config";

import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { RunnableTools } from "openai/lib/RunnableFunction";

import Ajv from "ajv";

import { promisify, inspect } from 'util';

export interface LangchainChatNodeDef extends NodeDef {
    name: string;
    config: LangChainConfigNodeDef,
    model: string;
    messages: any;
    messagesType: string;
    customOptions: any;
    customOptionsType: string;
    tools: {
        name: string,
        nameType: string,
        description: string,
        descriptionType: string,
        schema: any,
        schemaType: string
    }[];
}

const LangchainChatNodeInitializer: NodeInitializer = (RED) => {
    const evaluateNodeProperty = promisify(RED.util.evaluateNodeProperty);

    function LangchainChatNode(this: Node & Pick<LangchainChatNodeDef, 'config'>, n: LangchainChatNodeDef) {
        RED.nodes.createNode(this, n);
        this.config = RED.nodes.getNode(n.config as any) as any;

        const node = this;

        node.on("input", async (msg: NodeMessage & { [k: string]: any }, send: any, done: any) => {
            const { url, apiKey } = node.config;
            const customOptions = await evaluateNodeProperty(n.customOptions, n.customOptionsType, node, msg);

            const client = new OpenAI({
                baseURL: url,
                apiKey: apiKey,
                ...customOptions
            });

            const messages: ChatCompletionMessageParam[] = await evaluateNodeProperty(n.messages, n.messagesType, node, msg);

            if (n.tools && n.tools.length > 0) {
                const tools: RunnableTools<any> = await Promise.all(n.tools.map(async (it) => {
                    const url = await evaluateNodeProperty(it.name, it.nameType, node, msg) as string;
                    const segs = url.split('/');
                    const name = segs[segs.length - 1];
                    const description = await evaluateNodeProperty(it.description, it.descriptionType, node, msg);
                    const schema = await evaluateNodeProperty(it.schema, it.schemaType, node, msg);
                    return {
                        type: 'function',
                        function: {
                            parse: (args: any) => {
                                const data = JSON.parse(args);
                                const ajv = new Ajv();
                                const valid = ajv.validate(schema, data);
                                if (!valid) {
                                    const error = new Error(ajv.errors!.map(it => `${it}`).join('\n'))
                                    error.name = 'ParsedError'
                                    throw error;
                                }
                                return data;
                            },
                            function: async (args: any) => {
                                if (name === '__structured_output__') {
                                    return args;
                                }
                                try {
                                    const response = await fetch(url, { // TODO(QL): Custom headers, query?
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify(args)
                                    })
                                    const text = await response.text();
                                    try {
                                        const json = JSON.parse(text);
                                        return json;
                                    } catch (error) {
                                        return text;
                                    }
                                } catch (error) {
                                    return error;
                                }
                            },
                            name,
                            description,
                            parameters: schema,
                        },
                    }
                }));

                node.log(`runTool: ${inspect({
                    model: n.model,
                    messages,
                    tools,
                }, false, 10)})`);

                try {
                    const messages1: ChatCompletionMessageParam[] = [];
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
                } catch (error) {
                    node.error(`error ${error}`);
                    done(error);
                }
            } else {
                try {
                    const chatCompletion = await client.chat.completions.create({
                        model: n.model,
                        messages,
                    });
                    msg.payload = chatCompletion.choices[0].message;
                    msg.messages = [...messages, messages];
                    send(msg);
                    done();
                } catch (error) {
                    node.error(`error ${error}`);
                    done(error);
                }
            }
        });
    }

    RED.nodes.registerType("openai-chat", LangchainChatNode);
};

module.exports = LangchainChatNodeInitializer;