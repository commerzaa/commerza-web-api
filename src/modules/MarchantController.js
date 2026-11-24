'use strict';
/**
 * Port of Controllers/WebPanelCntrl/MarchantController.cs (scaffold controller, 5 actions, conventional route api/Marchant/{id?}).
 * Web API conventional routing picks the action by HTTP verb.
 */
const express = require('express');

const router = express.Router();

const isInt = (v) => /^[+-]?\d+$/.test(String(v));
const badId = (res) => res.status(400).json({
  Message: 'The request is invalid.',
  MessageDetail: "The parameters dictionary contains a null entry for parameter 'id' of non-nullable type 'System.Int32'.",
});

// public - GET api/<controller>
router.get('/api/Marchant', (req, res) => res.json(['value1', 'value2']));

// public - GET api/<controller>/5
router.get('/api/Marchant/:id', (req, res) => {
  if (!isInt(req.params.id)) return badId(res);
  return res.json('value');
});

// public - POST api/<controller>   (void => 204 No Content)
router.post(['/api/Marchant', '/api/Marchant/:id'], (req, res) => res.status(204).end());

// public - PUT api/<controller>/5  (void => 204 No Content)
router.put('/api/Marchant/:id', (req, res) => {
  if (!isInt(req.params.id)) return badId(res);
  return res.status(204).end();
});

// public - DELETE api/<controller>/5  (void => 204 No Content)
router.delete('/api/Marchant/:id', (req, res) => {
  if (!isInt(req.params.id)) return badId(res);
  return res.status(204).end();
});

module.exports = router;
