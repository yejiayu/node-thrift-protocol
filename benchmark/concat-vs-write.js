suite('buffer', () => {
  bench('concat', () => {
    Buffer.concat([Buffer.from('123'), Buffer.from('123')]);
  });

  bench('write', () => {
    const buf = Buffer.allocUnsafe(6);
    buf.write('123');
    buf.write('123');
  });
});
