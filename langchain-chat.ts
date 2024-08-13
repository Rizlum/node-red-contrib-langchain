import { Node, NodeDef, NodeInitializer, NodeMessage } from "node-red";
import { LangChainConfigNodeDef } from "./langchain-config";

import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatOpenAI } from "@langchain/openai";

import { promisify } from 'util';

export interface LangchainChatNodeDef extends NodeDef {
    name: string;
    config: LangChainConfigNodeDef,
    model: string;
    messages: any;
    messagesType: string;
    customHeaders: any;
    customHeadersType: string;
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
            const customHeaders = await evaluateNodeProperty(n.customHeaders, n.customHeadersType, node, msg);

            const model = new ChatOpenAI({
                model: n.model,
                apiKey,
                configuration: {
                    baseURL: url,
                    defaultHeaders: customHeaders
                },
                ...customOptions
            });

            const parser = new StringOutputParser();

            const chain = model.pipe(parser);

            const messages0 = await evaluateNodeProperty(n.messages, n.messagesType, node, msg);
            const messages = messages0.map((it: ChatCompletionMessageParam) => {
                switch (it.role) {
                    case 'system': return new SystemMessage(it.content as string);  // FIXME(QL): Type, more complex messages
                    case 'assistant': return new AIMessage(it.content as string);
                    case 'user': return new HumanMessage(it.content as string);
                    default:
                        node.warn(`ignore message as its role is unknown '${it}'`);
                        return;
                }
            }).filter((it: any) => it);

            node.log(`messages ${messages}`);

            try {
                const result = await chain.invoke(messages);
                msg.payload = result;
                send(msg);
                done();
            } catch (error) {
                node.error(`error ${error}`);
                done(error);
            }
        });
    }

    RED.nodes.registerType("langchain-chat", LangchainChatNode);
};

module.exports = LangchainChatNodeInitializer;