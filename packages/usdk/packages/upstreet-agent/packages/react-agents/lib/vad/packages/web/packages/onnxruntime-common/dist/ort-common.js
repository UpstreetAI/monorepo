/*!
 * ONNX Runtime Common v1.14.0
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["ort"] = factory();
	else
		root["ort"] = factory();
})(self, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./lib/backend-impl.ts":
/*!*****************************!*\
  !*** ./lib/backend-impl.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "registerBackend": () => (/* binding */ registerBackend),
/* harmony export */   "resolveBackend": () => (/* binding */ resolveBackend)
/* harmony export */ });
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
const backends = {};
const backendsSortedByPriority = [];
/**
 * Register a backend.
 *
 * @param name - the name as a key to lookup as an execution provider.
 * @param backend - the backend object.
 * @param priority - an integer indicating the priority of the backend. Higher number means higher priority. if priority
 * < 0, it will be considered as a 'beta' version and will not be used as a fallback backend by default.
 *
 * @internal
 */
const registerBackend = (name, backend, priority) => {
    if (backend && typeof backend.init === 'function' && typeof backend.createSessionHandler === 'function') {
        const currentBackend = backends[name];
        if (currentBackend === undefined) {
            backends[name] = { backend, priority };
        }
        else if (currentBackend.priority > priority) {
            // same name is already registered with a higher priority. skip registeration.
            return;
        }
        else if (currentBackend.priority === priority) {
            if (currentBackend.backend !== backend) {
                throw new Error(`cannot register backend "${name}" using priority ${priority}`);
            }
        }
        if (priority >= 0) {
            const i = backendsSortedByPriority.indexOf(name);
            if (i !== -1) {
                backendsSortedByPriority.splice(i, 1);
            }
            for (let i = 0; i < backendsSortedByPriority.length; i++) {
                if (backends[backendsSortedByPriority[i]].priority <= priority) {
                    backendsSortedByPriority.splice(i, 0, name);
                    return;
                }
            }
            backendsSortedByPriority.push(name);
        }
        return;
    }
    throw new TypeError('not a valid backend');
};
/**
 * Resolve backend by specified hints.
 *
 * @param backendHints - a list of execution provider names to lookup. If omitted use registered backends as list.
 * @returns a promise that resolves to the backend.
 *
 * @internal
 */
const resolveBackend = async (backendHints) => {
    const backendNames = backendHints.length === 0 ? backendsSortedByPriority : backendHints;
    const errors = [];
    for (const backendName of backendNames) {
        const backendInfo = backends[backendName];
        if (backendInfo) {
            if (backendInfo.initialized) {
                return backendInfo.backend;
            }
            else if (backendInfo.aborted) {
                continue; // current backend is unavailable; try next
            }
            const isInitializing = !!backendInfo.initPromise;
            try {
                if (!isInitializing) {
                    backendInfo.initPromise = backendInfo.backend.init();
                }
                await backendInfo.initPromise;
                backendInfo.initialized = true;
                return backendInfo.backend;
            }
            catch (e) {
                if (!isInitializing) {
                    errors.push({ name: backendName, err: e });
                }
                backendInfo.aborted = true;
            }
            finally {
                delete backendInfo.initPromise;
            }
        }
    }
    throw new Error(`no available backend found. ERR: ${errors.map(e => `[${e.name}] ${e.err}`).join(', ')}`);
};


/***/ }),

/***/ "./lib/backend.ts":
/*!************************!*\
  !*** ./lib/backend.ts ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "registerBackend": () => (/* reexport safe */ _backend_impl__WEBPACK_IMPORTED_MODULE_0__.registerBackend)
/* harmony export */ });
/* harmony import */ var _backend_impl__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./backend-impl */ "./lib/backend-impl.ts");
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.



/***/ }),

/***/ "./lib/env-impl.ts":
/*!*************************!*\
  !*** ./lib/env-impl.ts ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EnvImpl": () => (/* binding */ EnvImpl)
/* harmony export */ });
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
class EnvImpl {
    constructor() {
        this.wasm = {};
        this.webgl = {};
        this.logLevelInternal = 'warning';
    }
    // TODO standadize the getter and setter convention in env for other fields.
    set logLevel(value) {
        if (value === undefined) {
            return;
        }
        if (typeof value !== 'string' || ['verbose', 'info', 'warning', 'error', 'fatal'].indexOf(value) === -1) {
            throw new Error(`Unsupported logging level: ${value}`);
        }
        this.logLevelInternal = value;
    }
    get logLevel() {
        return this.logLevelInternal;
    }
}


/***/ }),

/***/ "./lib/env.ts":
/*!********************!*\
  !*** ./lib/env.ts ***!
  \********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "env": () => (/* binding */ env)
/* harmony export */ });
/* harmony import */ var _env_impl__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./env-impl */ "./lib/env-impl.ts");
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/**
 * Represent a set of flags as a global singleton.
 */
const env = new _env_impl__WEBPACK_IMPORTED_MODULE_0__.EnvImpl();


/***/ }),

/***/ "./lib/inference-session-impl.ts":
/*!***************************************!*\
  !*** ./lib/inference-session-impl.ts ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "InferenceSession": () => (/* binding */ InferenceSession)
/* harmony export */ });
/* harmony import */ var _backend_impl__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./backend-impl */ "./lib/backend-impl.ts");
/* harmony import */ var _tensor__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./tensor */ "./lib/tensor.ts");
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.


class InferenceSession {
    constructor(handler) {
        this.handler = handler;
    }
    async run(feeds, arg1, arg2) {
        const fetches = {};
        let options = {};
        // check inputs
        if (typeof feeds !== 'object' || feeds === null || feeds instanceof _tensor__WEBPACK_IMPORTED_MODULE_1__.Tensor || Array.isArray(feeds)) {
            throw new TypeError('\'feeds\' must be an object that use input names as keys and OnnxValue as corresponding values.');
        }
        let isFetchesEmpty = true;
        // determine which override is being used
        if (typeof arg1 === 'object') {
            if (arg1 === null) {
                throw new TypeError('Unexpected argument[1]: cannot be null.');
            }
            if (arg1 instanceof _tensor__WEBPACK_IMPORTED_MODULE_1__.Tensor) {
                throw new TypeError('\'fetches\' cannot be a Tensor');
            }
            if (Array.isArray(arg1)) {
                if (arg1.length === 0) {
                    throw new TypeError('\'fetches\' cannot be an empty array.');
                }
                isFetchesEmpty = false;
                // output names
                for (const name of arg1) {
                    if (typeof name !== 'string') {
                        throw new TypeError('\'fetches\' must be a string array or an object.');
                    }
                    if (this.outputNames.indexOf(name) === -1) {
                        throw new RangeError(`'fetches' contains invalid output name: ${name}.`);
                    }
                    fetches[name] = null;
                }
                if (typeof arg2 === 'object' && arg2 !== null) {
                    options = arg2;
                }
                else if (typeof arg2 !== 'undefined') {
                    throw new TypeError('\'options\' must be an object.');
                }
            }
            else {
                // decide whether arg1 is fetches or options
                // if any output name is present and its value is valid OnnxValue, we consider it fetches
                let isFetches = false;
                const arg1Keys = Object.getOwnPropertyNames(arg1);
                for (const name of this.outputNames) {
                    if (arg1Keys.indexOf(name) !== -1) {
                        const v = arg1[name];
                        if (v === null || v instanceof _tensor__WEBPACK_IMPORTED_MODULE_1__.Tensor) {
                            isFetches = true;
                            isFetchesEmpty = false;
                            fetches[name] = v;
                        }
                    }
                }
                if (isFetches) {
                    if (typeof arg2 === 'object' && arg2 !== null) {
                        options = arg2;
                    }
                    else if (typeof arg2 !== 'undefined') {
                        throw new TypeError('\'options\' must be an object.');
                    }
                }
                else {
                    options = arg1;
                }
            }
        }
        else if (typeof arg1 !== 'undefined') {
            throw new TypeError('Unexpected argument[1]: must be \'fetches\' or \'options\'.');
        }
        // check if all inputs are in feed
        for (const name of this.inputNames) {
            if (typeof feeds[name] === 'undefined') {
                throw new Error(`input '${name}' is missing in 'feeds'.`);
            }
        }
        // if no fetches is specified, we use the full output names list
        if (isFetchesEmpty) {
            for (const name of this.outputNames) {
                fetches[name] = null;
            }
        }
        // feeds, fetches and options are prepared
        const results = await this.handler.run(feeds, fetches, options);
        const returnValue = {};
        for (const key in results) {
            if (Object.hasOwnProperty.call(results, key)) {
                returnValue[key] = new _tensor__WEBPACK_IMPORTED_MODULE_1__.Tensor(results[key].type, results[key].data, results[key].dims);
            }
        }
        return returnValue;
    }
    static async create(arg0, arg1, arg2, arg3) {
        // either load from a file or buffer
        let filePathOrUint8Array;
        let options = {};
        if (typeof arg0 === 'string') {
            filePathOrUint8Array = arg0;
            if (typeof arg1 === 'object' && arg1 !== null) {
                options = arg1;
            }
            else if (typeof arg1 !== 'undefined') {
                throw new TypeError('\'options\' must be an object.');
            }
        }
        else if (arg0 instanceof Uint8Array) {
            filePathOrUint8Array = arg0;
            if (typeof arg1 === 'object' && arg1 !== null) {
                options = arg1;
            }
            else if (typeof arg1 !== 'undefined') {
                throw new TypeError('\'options\' must be an object.');
            }
        }
        else if (arg0 instanceof ArrayBuffer ||
            (typeof SharedArrayBuffer !== 'undefined' && arg0 instanceof SharedArrayBuffer)) {
            const buffer = arg0;
            let byteOffset = 0;
            let byteLength = arg0.byteLength;
            if (typeof arg1 === 'object' && arg1 !== null) {
                options = arg1;
            }
            else if (typeof arg1 === 'number') {
                byteOffset = arg1;
                if (!Number.isSafeInteger(byteOffset)) {
                    throw new RangeError('\'byteOffset\' must be an integer.');
                }
                if (byteOffset < 0 || byteOffset >= buffer.byteLength) {
                    throw new RangeError(`'byteOffset' is out of range [0, ${buffer.byteLength}).`);
                }
                byteLength = arg0.byteLength - byteOffset;
                if (typeof arg2 === 'number') {
                    byteLength = arg2;
                    if (!Number.isSafeInteger(byteLength)) {
                        throw new RangeError('\'byteLength\' must be an integer.');
                    }
                    if (byteLength <= 0 || byteOffset + byteLength > buffer.byteLength) {
                        throw new RangeError(`'byteLength' is out of range (0, ${buffer.byteLength - byteOffset}].`);
                    }
                    if (typeof arg3 === 'object' && arg3 !== null) {
                        options = arg3;
                    }
                    else if (typeof arg3 !== 'undefined') {
                        throw new TypeError('\'options\' must be an object.');
                    }
                }
                else if (typeof arg2 !== 'undefined') {
                    throw new TypeError('\'byteLength\' must be a number.');
                }
            }
            else if (typeof arg1 !== 'undefined') {
                throw new TypeError('\'options\' must be an object.');
            }
            filePathOrUint8Array = new Uint8Array(buffer, byteOffset, byteLength);
        }
        else {
            throw new TypeError('Unexpected argument[0]: must be \'path\' or \'buffer\'.');
        }
        // get backend hints
        const eps = options.executionProviders || [];
        const backendHints = eps.map(i => typeof i === 'string' ? i : i.name);
        const backend = await (0,_backend_impl__WEBPACK_IMPORTED_MODULE_0__.resolveBackend)(backendHints);
        const handler = await backend.createSessionHandler(filePathOrUint8Array, options);
        return new InferenceSession(handler);
    }
    startProfiling() {
        this.handler.startProfiling();
    }
    endProfiling() {
        this.handler.endProfiling();
    }
    get inputNames() {
        return this.handler.inputNames;
    }
    get outputNames() {
        return this.handler.outputNames;
    }
}


/***/ }),

/***/ "./lib/inference-session.ts":
/*!**********************************!*\
  !*** ./lib/inference-session.ts ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "InferenceSession": () => (/* binding */ InferenceSession)
/* harmony export */ });
/* harmony import */ var _inference_session_impl__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./inference-session-impl */ "./lib/inference-session-impl.ts");
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// eslint-disable-next-line @typescript-eslint/naming-convention
const InferenceSession = _inference_session_impl__WEBPACK_IMPORTED_MODULE_0__.InferenceSession;


/***/ }),

/***/ "./lib/onnx-value.ts":
/*!***************************!*\
  !*** ./lib/onnx-value.ts ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.



/***/ }),

/***/ "./lib/tensor-impl.ts":
/*!****************************!*\
  !*** ./lib/tensor-impl.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Tensor": () => (/* binding */ Tensor)
/* harmony export */ });
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
const isBigInt64ArrayAvailable = typeof BigInt64Array !== 'undefined' && typeof BigInt64Array.from === 'function';
const isBigUint64ArrayAvailable = typeof BigUint64Array !== 'undefined' && typeof BigUint64Array.from === 'function';
// a runtime map that maps type string to TypedArray constructor. Should match Tensor.DataTypeMap.
const NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP = new Map([
    ['float32', Float32Array],
    ['uint8', Uint8Array],
    ['int8', Int8Array],
    ['uint16', Uint16Array],
    ['int16', Int16Array],
    ['int32', Int32Array],
    ['bool', Uint8Array],
    ['float64', Float64Array],
    ['uint32', Uint32Array],
]);
// a runtime map that maps type string to TypedArray constructor. Should match Tensor.DataTypeMap.
const NUMERIC_TENSOR_TYPEDARRAY_TO_TYPE_MAP = new Map([
    [Float32Array, 'float32'],
    [Uint8Array, 'uint8'],
    [Int8Array, 'int8'],
    [Uint16Array, 'uint16'],
    [Int16Array, 'int16'],
    [Int32Array, 'int32'],
    [Float64Array, 'float64'],
    [Uint32Array, 'uint32'],
]);
if (isBigInt64ArrayAvailable) {
    NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP.set('int64', BigInt64Array);
    NUMERIC_TENSOR_TYPEDARRAY_TO_TYPE_MAP.set(BigInt64Array, 'int64');
}
if (isBigUint64ArrayAvailable) {
    NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP.set('uint64', BigUint64Array);
    NUMERIC_TENSOR_TYPEDARRAY_TO_TYPE_MAP.set(BigUint64Array, 'uint64');
}
/**
 * calculate size from dims.
 *
 * @param dims the dims array. May be an illegal input.
 */
const calculateSize = (dims) => {
    let size = 1;
    for (let i = 0; i < dims.length; i++) {
        const dim = dims[i];
        if (typeof dim !== 'number' || !Number.isSafeInteger(dim)) {
            throw new TypeError(`dims[${i}] must be an integer, got: ${dim}`);
        }
        if (dim < 0) {
            throw new RangeError(`dims[${i}] must be a non-negative integer, got: ${dim}`);
        }
        size *= dim;
    }
    return size;
};
class Tensor {
    constructor(arg0, arg1, arg2) {
        let type;
        let data;
        let dims;
        // check whether arg0 is type or data
        if (typeof arg0 === 'string') {
            //
            // Override: constructor(type, data, ...)
            //
            type = arg0;
            dims = arg2;
            if (arg0 === 'string') {
                // string tensor
                if (!Array.isArray(arg1)) {
                    throw new TypeError('A string tensor\'s data must be a string array.');
                }
                // we don't check whether every element in the array is string; this is too slow. we assume it's correct and
                // error will be populated at inference
                data = arg1;
            }
            else {
                // numeric tensor
                const typedArrayConstructor = NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP.get(arg0);
                if (typedArrayConstructor === undefined) {
                    throw new TypeError(`Unsupported tensor type: ${arg0}.`);
                }
                if (Array.isArray(arg1)) {
                    // use 'as any' here because TypeScript's check on type of 'SupportedTypedArrayConstructors.from()' produces
                    // incorrect results.
                    // 'typedArrayConstructor' should be one of the typed array prototype objects.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    data = typedArrayConstructor.from(arg1);
                }
                else if (arg1 instanceof typedArrayConstructor) {
                    data = arg1;
                }
                else {
                    throw new TypeError(`A ${type} tensor's data must be type of ${typedArrayConstructor}`);
                }
            }
        }
        else {
            //
            // Override: constructor(data, ...)
            //
            dims = arg1;
            if (Array.isArray(arg0)) {
                // only boolean[] and string[] is supported
                if (arg0.length === 0) {
                    throw new TypeError('Tensor type cannot be inferred from an empty array.');
                }
                const firstElementType = typeof arg0[0];
                if (firstElementType === 'string') {
                    type = 'string';
                    data = arg0;
                }
                else if (firstElementType === 'boolean') {
                    type = 'bool';
                    // 'arg0' is of type 'boolean[]'. Uint8Array.from(boolean[]) actually works, but typescript thinks this is
                    // wrong type. We use 'as any' to make it happy.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    data = Uint8Array.from(arg0);
                }
                else {
                    throw new TypeError(`Invalid element type of data array: ${firstElementType}.`);
                }
            }
            else {
                // get tensor type from TypedArray
                const mappedType = NUMERIC_TENSOR_TYPEDARRAY_TO_TYPE_MAP.get(arg0.constructor);
                if (mappedType === undefined) {
                    throw new TypeError(`Unsupported type for tensor data: ${arg0.constructor}.`);
                }
                type = mappedType;
                data = arg0;
            }
        }
        // type and data is processed, now processing dims
        if (dims === undefined) {
            // assume 1-D tensor if dims omitted
            dims = [data.length];
        }
        else if (!Array.isArray(dims)) {
            throw new TypeError('A tensor\'s dims must be a number array');
        }
        // perform check
        const size = calculateSize(dims);
        if (size !== data.length) {
            throw new Error(`Tensor's size(${size}) does not match data length(${data.length}).`);
        }
        this.dims = dims;
        this.type = type;
        this.data = data;
        this.size = size;
    }
    // #endregion
    /**
     * Create a new tensor object from image object
     *
     * @param buffer - Extracted image buffer data - assuming RGBA format
     * @param imageFormat - input image configuration - required configurations height, width, format
     * @param tensorFormat - output tensor configuration - Default is RGB format
     */
    static bufferToTensor(buffer, options) {
        if (buffer === undefined) {
            throw new Error('Image buffer must be defined');
        }
        if (options.height === undefined || options.width === undefined) {
            throw new Error('Image height and width must be defined');
        }
        const { height, width } = options;
        const norm = options.norm;
        let normMean;
        let normBias;
        if (norm === undefined || norm.mean === undefined) {
            normMean = 255;
        }
        else {
            normMean = norm.mean;
        }
        if (norm === undefined || norm.bias === undefined) {
            normBias = 0;
        }
        else {
            normBias = norm.bias;
        }
        const inputformat = options.bitmapFormat !== undefined ? options.bitmapFormat : 'RGBA';
        // default value is RGBA since imagedata and HTMLImageElement uses it
        const outputformat = options.tensorFormat !== undefined ?
            (options.tensorFormat !== undefined ? options.tensorFormat : 'RGB') :
            'RGB';
        const offset = height * width;
        const float32Data = outputformat === 'RGBA' ? new Float32Array(offset * 4) : new Float32Array(offset * 3);
        // Default pointer assignments
        let step = 4, rImagePointer = 0, gImagePointer = 1, bImagePointer = 2, aImagePointer = 3;
        let rTensorPointer = 0, gTensorPointer = offset, bTensorPointer = offset * 2, aTensorPointer = -1;
        // Updating the pointer assignments based on the input image format
        if (inputformat === 'RGB') {
            step = 3;
            rImagePointer = 0;
            gImagePointer = 1;
            bImagePointer = 2;
            aImagePointer = -1;
        }
        // Updating the pointer assignments based on the output tensor format
        if (outputformat === 'RGBA') {
            aTensorPointer = offset * 3;
        }
        else if (outputformat === 'RBG') {
            rTensorPointer = 0;
            bTensorPointer = offset;
            gTensorPointer = offset * 2;
        }
        else if (outputformat === 'BGR') {
            bTensorPointer = 0;
            gTensorPointer = offset;
            rTensorPointer = offset * 2;
        }
        for (let i = 0; i < offset; i++, rImagePointer += step, bImagePointer += step, gImagePointer += step, aImagePointer += step) {
            float32Data[rTensorPointer++] = (buffer[rImagePointer] + normBias) / normMean;
            float32Data[gTensorPointer++] = (buffer[gImagePointer] + normBias) / normMean;
            float32Data[bTensorPointer++] = (buffer[bImagePointer] + normBias) / normMean;
            if (aTensorPointer !== -1 && aImagePointer !== -1) {
                float32Data[aTensorPointer++] = (buffer[aImagePointer] + normBias) / normMean;
            }
        }
        // Float32Array -> ort.Tensor
        const outputTensor = outputformat === 'RGBA' ? new Tensor('float32', float32Data, [1, 4, height, width]) :
            new Tensor('float32', float32Data, [1, 3, height, width]);
        return outputTensor;
    }
    static async fromImage(image, options) {
        // checking the type of image object
        const isHTMLImageEle = typeof (HTMLImageElement) !== 'undefined' && image instanceof HTMLImageElement;
        const isImageDataEle = typeof (ImageData) !== 'undefined' && image instanceof ImageData;
        const isImageBitmap = typeof (ImageBitmap) !== 'undefined' && image instanceof ImageBitmap;
        const isURL = typeof (String) !== 'undefined' && (image instanceof String || typeof image === 'string');
        let data;
        let tensorConfig = {};
        // filling and checking image configuration options
        if (isHTMLImageEle) {
            // HTMLImageElement - image object - format is RGBA by default
            const canvas = document.createElement('canvas');
            const pixels2DContext = canvas.getContext('2d');
            if (pixels2DContext != null) {
                let height = image.naturalHeight;
                let width = image.naturalWidth;
                if (options !== undefined && options.resizedHeight !== undefined && options.resizedWidth !== undefined) {
                    height = options.resizedHeight;
                    width = options.resizedWidth;
                }
                if (options !== undefined) {
                    tensorConfig = options;
                    if (options.tensorFormat !== undefined) {
                        throw new Error('Image input config format must be RGBA for HTMLImageElement');
                    }
                    else {
                        tensorConfig.tensorFormat = 'RGBA';
                    }
                    if (options.height !== undefined && options.height !== height) {
                        throw new Error('Image input config height doesn\'t match HTMLImageElement height');
                    }
                    else {
                        tensorConfig.height = height;
                    }
                    if (options.width !== undefined && options.width !== width) {
                        throw new Error('Image input config width doesn\'t match HTMLImageElement width');
                    }
                    else {
                        tensorConfig.width = width;
                    }
                }
                else {
                    tensorConfig.tensorFormat = 'RGBA';
                    tensorConfig.height = height;
                    tensorConfig.width = width;
                }
                canvas.width = width;
                canvas.height = height;
                pixels2DContext.drawImage(image, 0, 0, width, height);
                data = pixels2DContext.getImageData(0, 0, width, height).data;
            }
            else {
                throw new Error('Can not access image data');
            }
        }
        else if (isImageDataEle) {
            // ImageData - image object - format is RGBA by default
            const format = 'RGBA';
            let height;
            let width;
            if (options !== undefined && options.resizedWidth !== undefined && options.resizedHeight !== undefined) {
                height = options.resizedHeight;
                width = options.resizedWidth;
            }
            else {
                height = image.height;
                width = image.width;
            }
            if (options !== undefined) {
                tensorConfig = options;
                if (options.bitmapFormat !== undefined && options.bitmapFormat !== format) {
                    throw new Error('Image input config format must be RGBA for ImageData');
                }
                else {
                    tensorConfig.bitmapFormat = 'RGBA';
                }
            }
            else {
                tensorConfig.bitmapFormat = 'RGBA';
            }
            tensorConfig.height = height;
            tensorConfig.width = width;
            if (options !== undefined) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                const pixels2DContext = tempCanvas.getContext('2d');
                if (pixels2DContext != null) {
                    pixels2DContext.putImageData(image, 0, 0);
                    data = pixels2DContext.getImageData(0, 0, width, height).data;
                }
                else {
                    throw new Error('Can not access image data');
                }
            }
            else {
                data = image.data;
            }
        }
        else if (isImageBitmap) {
            // ImageBitmap - image object - format must be provided by user
            if (options === undefined) {
                throw new Error('Please provide image config with format for Imagebitmap');
            }
            if (options.bitmapFormat !== undefined) {
                throw new Error('Image input config format must be defined for ImageBitmap');
            }
            const pixels2DContext = document.createElement('canvas').getContext('2d');
            if (pixels2DContext != null) {
                const height = image.height;
                const width = image.width;
                pixels2DContext.drawImage(image, 0, 0, width, height);
                data = pixels2DContext.getImageData(0, 0, width, height).data;
                if (options !== undefined) {
                    // using square brackets to avoid TS error - type 'never'
                    if (options.height !== undefined && options.height !== height) {
                        throw new Error('Image input config height doesn\'t match ImageBitmap height');
                    }
                    else {
                        tensorConfig.height = height;
                    }
                    // using square brackets to avoid TS error - type 'never'
                    if (options.width !== undefined && options.width !== width) {
                        throw new Error('Image input config width doesn\'t match ImageBitmap width');
                    }
                    else {
                        tensorConfig.width = width;
                    }
                }
                else {
                    tensorConfig.height = height;
                    tensorConfig.width = width;
                }
                return Tensor.bufferToTensor(data, tensorConfig);
            }
            else {
                throw new Error('Can not access image data');
            }
        }
        else if (isURL) {
            return new Promise((resolve, reject) => {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                if (!image || !context) {
                    return reject();
                }
                const newImage = new Image();
                newImage.crossOrigin = 'Anonymous';
                newImage.src = image;
                newImage.onload = () => {
                    canvas.width = newImage.width;
                    canvas.height = newImage.height;
                    context.drawImage(newImage, 0, 0, canvas.width, canvas.height);
                    const img = context.getImageData(0, 0, canvas.width, canvas.height);
                    if (options !== undefined) {
                        // using square brackets to avoid TS error - type 'never'
                        if (options.height !== undefined && options.height !== canvas.height) {
                            throw new Error('Image input config height doesn\'t match ImageBitmap height');
                        }
                        else {
                            tensorConfig.height = canvas.height;
                        }
                        // using square brackets to avoid TS error - type 'never'
                        if (options.width !== undefined && options.width !== canvas.width) {
                            throw new Error('Image input config width doesn\'t match ImageBitmap width');
                        }
                        else {
                            tensorConfig.width = canvas.width;
                        }
                    }
                    else {
                        tensorConfig.height = canvas.height;
                        tensorConfig.width = canvas.width;
                    }
                    resolve(Tensor.bufferToTensor(img.data, tensorConfig));
                };
            });
        }
        else {
            throw new Error('Input data provided is not supported - aborted tensor creation');
        }
        if (data !== undefined) {
            return Tensor.bufferToTensor(data, tensorConfig);
        }
        else {
            throw new Error('Input data provided is not supported - aborted tensor creation');
        }
    }
    toImageData(options) {
        var _a, _b;
        const pixels2DContext = document.createElement('canvas').getContext('2d');
        let image;
        if (pixels2DContext != null) {
            // Default values for height and width & format
            const width = this.dims[3];
            const height = this.dims[2];
            const channels = this.dims[1];
            const inputformat = options !== undefined ? (options.format !== undefined ? options.format : 'RGB') : 'RGB';
            const normMean = options !== undefined ? (((_a = options.norm) === null || _a === void 0 ? void 0 : _a.mean) !== undefined ? options.norm.mean : 255) : 255;
            const normBias = options !== undefined ? (((_b = options.norm) === null || _b === void 0 ? void 0 : _b.bias) !== undefined ? options.norm.bias : 0) : 0;
            const offset = height * width;
            if (options !== undefined) {
                if (options.height !== undefined && options.height !== height) {
                    throw new Error('Image output config height doesn\'t match tensor height');
                }
                if (options.width !== undefined && options.width !== width) {
                    throw new Error('Image output config width doesn\'t match tensor width');
                }
                if (options.format !== undefined && (channels === 4 && options.format !== 'RGBA') ||
                    (channels === 3 && (options.format !== 'RGB' && options.format !== 'BGR'))) {
                    throw new Error('Tensor format doesn\'t match input tensor dims');
                }
            }
            // Default pointer assignments
            const step = 4;
            let rImagePointer = 0, gImagePointer = 1, bImagePointer = 2, aImagePointer = 3;
            let rTensorPointer = 0, gTensorPointer = offset, bTensorPointer = offset * 2, aTensorPointer = -1;
            // Updating the pointer assignments based on the input image format
            if (inputformat === 'RGBA') {
                rTensorPointer = 0;
                gTensorPointer = offset;
                bTensorPointer = offset * 2;
                aTensorPointer = offset * 3;
            }
            else if (inputformat === 'RGB') {
                rTensorPointer = 0;
                gTensorPointer = offset;
                bTensorPointer = offset * 2;
            }
            else if (inputformat === 'RBG') {
                rTensorPointer = 0;
                bTensorPointer = offset;
                gTensorPointer = offset * 2;
            }
            image = pixels2DContext.createImageData(width, height);
            for (let i = 0; i < height * width; rImagePointer += step, gImagePointer += step, bImagePointer += step, aImagePointer += step, i++) {
                image.data[rImagePointer] = (this.data[rTensorPointer++] - normBias) * normMean; // R value
                image.data[gImagePointer] = (this.data[gTensorPointer++] - normBias) * normMean; // G value
                image.data[bImagePointer] = (this.data[bTensorPointer++] - normBias) * normMean; // B value
                image.data[aImagePointer] =
                    aTensorPointer === -1 ? 255 : (this.data[aTensorPointer++] - normBias) * normMean; // A value
            }
        }
        else {
            throw new Error('Can not access image data');
        }
        return image;
    }
    // #endregion
    // #region tensor utilities
    reshape(dims) {
        return new Tensor(this.type, this.data, dims);
    }
}


/***/ }),

/***/ "./lib/tensor.ts":
/*!***********************!*\
  !*** ./lib/tensor.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Tensor": () => (/* binding */ Tensor)
/* harmony export */ });
/* harmony import */ var _tensor_impl__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./tensor-impl */ "./lib/tensor-impl.ts");
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// eslint-disable-next-line @typescript-eslint/naming-convention
const Tensor = _tensor_impl__WEBPACK_IMPORTED_MODULE_0__.Tensor;


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!**********************!*\
  !*** ./lib/index.ts ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "InferenceSession": () => (/* reexport safe */ _inference_session__WEBPACK_IMPORTED_MODULE_2__.InferenceSession),
/* harmony export */   "Tensor": () => (/* reexport safe */ _tensor__WEBPACK_IMPORTED_MODULE_3__.Tensor),
/* harmony export */   "env": () => (/* reexport safe */ _env__WEBPACK_IMPORTED_MODULE_1__.env),
/* harmony export */   "registerBackend": () => (/* reexport safe */ _backend__WEBPACK_IMPORTED_MODULE_0__.registerBackend)
/* harmony export */ });
/* harmony import */ var _backend__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./backend */ "./lib/backend.ts");
/* harmony import */ var _env__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./env */ "./lib/env.ts");
/* harmony import */ var _inference_session__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./inference-session */ "./lib/inference-session.ts");
/* harmony import */ var _tensor__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./tensor */ "./lib/tensor.ts");
/* harmony import */ var _onnx_value__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./onnx-value */ "./lib/onnx-value.ts");
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
/**
 * # ONNX Runtime JavaScript API
 *
 * ONNX Runtime JavaScript API is a unified API for all JavaScript usages, including the following NPM packages:
 *
 * - [onnxruntime-node](https://www.npmjs.com/package/onnxruntime-node)
 * - [onnxruntime-web](https://www.npmjs.com/package/onnxruntime-web)
 * - [onnxruntime-react-native](https://www.npmjs.com/package/onnxruntime-react-native)
 *
 * See also:
 * - [Get Started](https://onnxruntime.ai/docs/get-started/with-javascript.html)
 * - [Inference examples](https://github.com/microsoft/onnxruntime-inference-examples/tree/main/js)
 *
 * @packageDocumentation
 */






})();

/******/ 	return __webpack_exports__;
/******/ })()
;
});