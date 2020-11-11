global.rooms.test = async foundation => {
  
  let { testNum=1 } = foundation.origArgs;
  let controls = await foundation.getRoom(`test.test${testNum}`);
  
  let HutControls = await foundation.getRoom('hinterlands.hutControls');
  return HutControls('t1.test', controls);
  
};
