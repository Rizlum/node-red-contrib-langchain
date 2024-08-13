import { Node, NodeDef, NodeInitializer, NodeMessage } from "node-red";
import { LangChainConfigNodeDef } from "./langchain-config";

import OpenAI from 'openai';
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";


import { promisify } from 'util';

export interface LangchainChatNodeDef extends NodeDef {
    name: string;
    config: LangChainConfigNodeDef,
    model: string;
    messages: any;
    messagesType: string;
    customOptions: any;
    customOptionsType: string;
}

const LangchainChatNodeInitializer: NodeInitializer = (RED) => {
    const evaluateNodeProperty = promisify(RED.util.evaluateNodeProperty);

    function LangchainChatNode(this: Node & Pick<LangchainChatNodeDef, 'config'>, n: LangchainChatNodeDef) {
        RED.nodes.createNode(this, n);
        this.config = RED.nodes.getNode(n.config as any) as any;

        const node = this;

        node.on("input", async (msg: NodeMessage, send: any, done: any) => {
            const { url, apiKey } = this.config;
            const customOptions = await evaluateNodeProperty(n.customOptions, n.customOptionsType, node, msg);

            const client = new OpenAI({
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
            } catch (error) {
                node.error(`error ${error}`);
                done(error);
            }
        });
    }

    RED.nodes.registerType("openai-chat", LangchainChatNode);
};

module.exports = LangchainChatNodeInitializer;