'use strict';
// Ported from Franchise\Controllers\AllAPI\Getusername.cs (Web API controller, scaffold stubs)
// Conventional Web API routes: api/{controller}/{id}  (action chosen by verb)
const express = require('express');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();

// public  Get() => ["value1","value2"]
router.get('/franchise/api/Getusername', asyncHandler(async (req, res) => {
  res.json(['value1', 'value2']);
}));
// public  Get(int id) => "value"
router.get('/franchise/api/Getusername/:id', asyncHandler(async (req, res) => {
  res.json('value');
}));
// public  Post([FromBody] string value) => void (204 No Content in Web API; 200 empty here)
router.post('/franchise/api/Getusername', asyncHandler(async (req, res) => {
  res.status(204).end();
}));
// public  Put(int id, [FromBody] string value)
router.put('/franchise/api/Getusername/:id', asyncHandler(async (req, res) => {
  res.status(204).end();
}));
// public  Delete(int id)
router.delete('/franchise/api/Getusername/:id', asyncHandler(async (req, res) => {
  res.status(204).end();
}));

module.exports = router;
