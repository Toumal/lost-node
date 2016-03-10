#!/bin/bash

cd dist
export NODE_ENV=development
node index.js $*
cd ..
