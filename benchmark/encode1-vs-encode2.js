const encode1 = require('./shim/encode1');
const encode2 = require('./shim/encode2');

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
          return { id: index, type: 'STRING', value: Math.random() + '' };
        })
      };
    })
  }
};

suite('encode', () => {
  bench('ping1', () => {
    encode1(pingMessage);
  });

  bench('ping2', () => {
    encode2(pingMessage);
  });

  bench('large1', () => {
    encode1(large);
  });

  bench('large2', () => {
    encode2(large);
  });
});
