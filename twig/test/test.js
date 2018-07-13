U.makeTwig({ name: 'test', twigs: [ 'clearing', 'record', 'hinterlands', 'real' ], make: (test, clearing, record, hinterlands, real) => {
  
  let { Val, Obj, Arr, Editor } = record;
  let { ClassicHtmlRealizer, Real, RealObj, RealArr, RealStr } = real;
  let { OutlineHinterlands, OutlinePassage, PassageHttp, PassageSokt } = hinterlands;
  
  let otlHut = Obj({ name: 'hut' });
  
  let otlTitle = otlHut.add(Val({ name: 'title', defaultValue: 'wheee' }));
  
  let otlHinterlands = otlHut.add(OutlineHinterlands({ name: 'lands', deployment: clearing.deployment }));
  
  let otlDataSet = otlHinterlands.add(Arr({ name: 'dataSet' }));
  let otlData = otlDataSet.setTemplate(Obj({ name: 'data' }), data => data.getChild('key').value);
  otlData.add(Val({ name: 'key' }));
  otlData.add(Val({ name: 'val' }));
  
  let otlPassages = otlHinterlands.add(Obj({ name: 'passages' }));
  otlPassages.add(OutlinePassage({ name: 'http', recCls: PassageHttp, hinterlands: otlHinterlands }));
  // otlPassages.add(OutlinePassage({ name: 'sokt', recCls: PassageSokt, hinterlands: otlHinterlands }));
  
  let editor = Editor();
  let hut = global.hut = editor.shape({ outline: otlHut });
  editor.run();
  
  
  /// {SERVER=
  
  let cnt = 0;
  let lands = hut.getChild('lands');
  
  setInterval(async () => {
    
    let dataSet = lands.getChild('dataSet');
    await lands.update(dataSet, { type: 'delta', add: {
      0: { type: 'exact', children: {
        key: 'key' + (cnt++),
        val: 'time: ' + U.timeMs()
      }}
    }});
    
  }, 1000);
  
  /// =SERVER} {CLIENT=
  
  // TODO: would be BEAUTIFUL if there was server-side realization as well
  // through Electron or some kinda GUI tool (maybe even custom????)
  
  let realizer = ClassicHtmlRealizer();
  
  let realHut = RealObj({ name: 'hut', realizer });
  
  let realTitle = realHut.add(RealStr({ name: 'title', realizer, rec: hut.getChild('title') }));
  
  let realDataSet = realHut.add(RealArr({ name: 'dataSet', realizer, rec: hut.getChild('lands.dataSet') }));
  realDataSet.setTemplate(data => {
    
    let realData = RealObj({ name: data.name });
    realData.add(RealStr({ name: 'key', realizer, rec: data.getChild('key') }));
    realData.add(RealStr({ name: 'val', realizer, rec: data.getChild('val') }));
    return realData;
    
  });
  
  (async () => {
    
    await realizer.ready;
    realHut.up();
    
  })();
  
  /// =CLIENT}
  
}});
