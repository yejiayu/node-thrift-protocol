const copy = require('./shim/copy');
const toString = require('./shim/toString');

const pingMessage = {
  name: 'ping',
  id: 10,
  type: 'REPLY',
  fields: [
    { id: 0, type: 'BOOL', value: true }
  ]
};

const large = {
  id: 0,
  type: 'LIST',
  value: {
    valueType: 'STRUCT',
    data: Array.from({ length: 1000 }, () => {
      return {
        fields: Array.from({ length: 1000 }, (item, index) => {
          return { id: index, type: 'STRING', value: Buffer.from(Math.random() + '') };
        })
      };
    })
  }
};

const bigStr = {
  name: Buffer.from(Array.from({ length: 10000 }).reduce((p, c) => p += 'ping', 'ping')),
  id: 10,
  type: 'REPLY',
  fields: [
    { id: 0, type: 'BOOL', value: true }
  ]
};

suite('encode', () => {
  bench('ping1-copy', () => {
    copy(pingMessage);
  });

  bench('ping2-toString', () => {
    toString(pingMessage);
  });

  bench('large1-copy', () => {
    copy(large);
  });

  bench('large2-toString', () => {
    toString(large);
  });

  bench('bigStr-copy', () => {
    copy(bigStr);
  });

  bench('bigStr-toString', () => {
    toString(bigStr);
  });
});
