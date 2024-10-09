"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultModelFetcher = void 0;
var defaultModelFetcher = function (path) {
    return fetch(path).then(function (model) { return model.arrayBuffer(); });
};
exports.defaultModelFetcher = defaultModelFetcher;
