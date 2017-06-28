var assert = function(val) {
  if (!val) throw new Error('Incorrect assert');
};

// Test IndexedDict
var obj = new PACK.quickDev.IndexedDict({ keySize: 3 });
obj.add([ 'x', 'y', 'z' ], 'xyz');
obj.add([ 'x', 'y', 'a' ], 'xya');
obj.add([ 'w', 'a', 'n' ], 'awn');
obj.add([ 'a', 'b', 'c' ], 'abc');
obj.add([ 'a', 'a', 'a' ], 'aaa');
obj.add([ 'b', 'c', 'd' ], 'bcd');

obj.rem('a');
assert(!('a' in obj.index));

assert(obj.find([ 'x', 'y', 'z']) === 'xyz');
assert(obj.find([ 'x', 'z', 'y']) === null);
assert(obj.find([ 'x', 'y', 'a']) === null);
assert(obj.find([ 'a', 'b', 'c']) === null);
assert(obj.find([ 'a', 'a', 'a']) === null);
assert(obj.find([ 'b', 'c', 'd']) === 'bcd');
assert(obj.find([ 'w', 'a', 'n']) === null);
assert(obj.find([ 'w' ]) === null);

obj.rem('b');
assert(!('b' in obj.index));
assert(!('c' in obj.index)); // Removed alongside b
