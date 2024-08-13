"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const LangChainConfigInitializer = function (RED) {
    function LangChainConfigNode(n) {
        RED.nodes.createNode(this, n);
        this.name = n.name;
        this.url = n.url;
        this.apiKey = n.apiKey;
    }
    RED.nodes.registerType("langchain-config", LangChainConfigNode);
};
module.exports = LangChainConfigInitializer;
