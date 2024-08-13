import { NodeAPI, Node, NodeDef, NodeInitializer } from "node-red";

export interface LangChainConfigNodeDef extends NodeDef {
    name: string;
    url: string;
    apiKey: string;
}

const LangChainConfigInitializer: NodeInitializer = function (RED) {
    function LangChainConfigNode(this: Node & LangChainConfigNodeDef, n: LangChainConfigNodeDef) {
        RED.nodes.createNode(this, n);
        this.name = n.name;
        this.url = n.url;
        this.apiKey = n.apiKey;
    }

    RED.nodes.registerType("langchain-config", LangChainConfigNode);
};

module.exports = LangChainConfigInitializer;