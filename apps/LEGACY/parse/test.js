'x.y.z'

// Start with only indirection
rst: []
stk: [ [ ObfIndirection ] ]
rem: 'x.y.z'

// Work on the last item's last element - EXPAND ObfIndirection because HAS ".inner" (pop it from prev stack)
rst: []
stk: [ [ ObfIndirection ] ]
rem: 'x.y.z'
	rst: []
	stk: [ [ ObfIdentifier ], [ '.' ], [ ..., ObfIndirection, ObfIndexing, ObfIdentifier ]  ]
	rem: 'x.y.z'

// Work on the last item's last element - MATCH ObfIdentifier because NO ".inner" (pop it from prev stack)
rst: []
stk: [ [ ObfIndirection ] ]
rem: 'x.y.z'
	rst: []
	stk: [ [ ObfIdentifier ], [ '.' ], [ ..., ObfIndirection, ObfIndexing ] ]
	rem: 'x.y.z'
		rst: [ new ObfIdentifier({ name: 'x' }) ]
		stk: [ [ ObfIdentifier ], [ '.' ] ]
		rem: '.y.z'

// Work on the last item's last element - MATCH '.' because NO ".inner" (pop it from prev stack)
rst: []
stk: [ [ ObfIndirection ] ]
rem: 'x.y.z'
	rst: []
	stk: [ [ ObfIdentifier ], [ '.' ], [ ..., ObfIndirection, ObfIndexing ] ]
	rem: 'x.y.z'
		rst: [ new ObfIdentifier({ name: 'x' }) ]
		stk: [ [ ObfIdentifier ], [ ] ]
		rem: '.y.z'
			rst: [ new ObfIdentifier({ name: 'x' }), '.' ]
			stk: [ [ ObfIdentifier ] ]
			rem: 'y.z'

// Work on the last item's last element - MATCH ObfIdentifier because NO ".inner" (pop it from prev stack)
rst: []
stk: [ [ ObfIndirection ] ]
rem: 'x.y.z'
	rst: []
	stk: [ [ ObfIdentifier ], [ '.' ], [ ..., ObfIndirection, ObfIndexing ] ]
	rem: 'x.y.z'
		rst: [ new ObfIdentifier({ name: 'x' }) ]
		stk: [ [ ObfIdentifier ], [ ] ]
		rem: '.y.z'
			rst: [ new ObfIdentifier({ name: 'x' }), '.' ]
			stk: [ [ ] ]
			rem: 'y.z'
				rst: [ new ObfIdentifier({ name: 'x' }), '.', new ObfIdentifier({ name: 'y' }) ]
				stk: [ ]
				rem: '.z'

// Work on the last item's last element - there isn't one, but input remains! Fall back (throw error prolly)
rst: []
stk: [ [ ObfIndirection ] ]
rem: 'x.y.z'
	rst: []
	stk: [ [ ObfIdentifier ], [ '.' ], [ ..., ObfIndirection, ObfIndexing ] ]
	rem: 'x.y.z'
		rst: [ new ObfIdentifier({ name: 'x' }) ]
		stk: [ [ ObfIdentifier ], [ ] ]
		rem: '.y.z'
			rst: [ new ObfIdentifier({ name: 'x' }), '.' ]
			stk: [ [ ] ]
			rem: 'y.z'

// Work on the last item's last element - there isn't one, but input remains! Fall back (throw error prolly)
rst: []
stk: [ [ ObfIndirection ] ]
rem: 'x.y.z'
	rst: []
	stk: [ [ ObfIdentifier ], [ '.' ], [ ..., ObfIndirection, ObfIndexing ] ]
	rem: 'x.y.z'
		rst: [ new ObfIdentifier({ name: 'x' }) ]
		stk: [ [ ObfIdentifier ], [ ] ]
		rem: '.y.z'

// Work on the last item's last element - there isn't one, but input remains! Fall back (throw error prolly)
rst: []
stk: [ [ ObfIndirection ] ]
rem: 'x.y.z'
	rst: []
	stk: [ [ ObfIdentifier ], [ '.' ], [ ..., ObfIndirection, ObfIndexing ] ]
	rem: 'x.y.z'

// Work on last item's last element - EXPAND ObfIndexing because HAS ".inner" (pop it from prev stack)
wrk: []
rst: []
stk: [ [ ObfIndirection ] ]
rem: 'x.y.z'
	wrk: [ ObfIndirection ]
	rst: []
	stk: [ [ ObfIdentifier ], [ '.' ], [ ..., ObfIndirection ] ]
	rem: 'x.y.z'
		wrk: [ ObfIndirection, ObfIndexing ]
		rst: []
		stk: [ [ ObfIdentifier ], [ '.' ], [ ']' ], [ ..., ObfIndirection, ObfIndexing, ObfIdentifier, ObfNumber ], [ '[' ], [ ..., ObfIndexing, ObfIndirection, ObfIdentifier ] ]
		rem: 'x.y.z'

// NOTE: If ObfIndexing comes first here, BIG TROUBLE!!!! (it will expand over and over and over)

// Work on last item's last element - MATCH '[' because NO ".inner" (pop it from prev stack) - NO MATCH! Fall back.
rst: []
stk: [ [ ObfIndirection ] ]
rem: 'x.y.z'
	rst: []
	stk: [ [ ObfIdentifier ], [ '.' ], [ ..., ObfIndirection ] ]
	rem: 'x.y.z'
		rst: []
		stk: [ [ ObfIdentifier ], [ '.' ], [ ']' ], [ ..., ObfIndirection, ObfIndexing, ObfIdentifier, ObfNumber ], [ '[' ], [ ..., ObfIndexing, ObfIndirection ] ]
		rem: 'x.y.z'
