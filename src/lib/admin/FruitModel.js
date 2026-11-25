/** Exports: class FruitModel (no table; props Fruits, FruitIds)
 *   Source Models/FruitModel.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const FruitModel = defineModel('FruitModel', null, { Fruits: null, FruitIds: null });

module.exports = FruitModel;
