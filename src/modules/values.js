'use strict';
/** Port of Controllers/ValuesController.cs (Web API template sample, 5 routes, public). */
const express = require('express');

const router = express.Router();

// public - GET api/values
router.get('/api/values', (req, res) => res.json(['value1', 'value2']));
// public - GET api/values/5
router.get('/api/values/:id', (req, res) => res.json('value'));
// public - POST api/values (void => 204 No Content)
router.post('/api/values', (req, res) => res.status(204).end());
// public - PUT api/values/5
router.put('/api/values/:id', (req, res) => res.status(204).end());
// public - DELETE api/values/5
router.delete('/api/values/:id', (req, res) => res.status(204).end());

module.exports = router;
