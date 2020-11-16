global.rooms['hinterlands.tmp'] = async foundation => {

  let Permissions = U.inspire({ name: 'Permissions', insps: { Tmp }, methods: (insp, Insp) => ({
    
    $mod: (parHut, rec, value) => {
      if (value === rec.val) return;
      parHut.tell({ command: `perm.${parHut.uid}.mod`, recUid: rec.uid, value });
    },
    $add: (parHut, rec, relName) => {
      parHut.tell({ command: `perm.${parHut.uid}.add`, recUid: rec.uid, relName });
    },
    $rem: (parHut, rec) => {
      parHut.tell({ command: `perm.${parHut.uid}.rem`, recUid: rec.uid });
    },
    
    init: function(parHut, kidHut) {
      this.parHut = parHut;
      this.kidHut = kidHut;
      this.recPerms = {};
      
      this.routes = [
        parHut.roadSrc(`perm.${kidHut.uid}.mod`).route(this.attemptMod.bind(this)),
        parHut.roadSrc(`perm.${kidHut.uid}.add`).route(this.attemptAdd.bind(this)),
        parHut.roadSrc(`perm.${kidHut.uid}.rem`).route(this.attemptRem.bind(this))
      ];
    },
    followRec: function(rec, ...perms) {
      
      if (rec.type.name === 'perm.perm') throw Error(`Can't assign permissions on Rec of type "perm.perm"`);
      
      let permRec = rec.relRecs('perm.perm/rec?').find(perm => perm.mems.hut.uid === this.kidHut.uid).val;
      if (!permRec) permRec = this.parHut.createRec('perm.perm', { 'rec?': rec, hut: this.kidHut }, {});
      
      if (!this.recPerms.has(rec.uid)) this.recPerms[rec.uid] = {};
      for (let perm of perms) {
        if (!this.recPerms[rec.uid].has(perm)) this.recPerms[rec.uid][perm] = 0;
        this.recPerms[rec.uid][perm]++
      }
      
      permRec.setVal(this.recPerms[rec.uid].map(v => !!v).gain({ get: C.skip }));
      
      let followDrop = this.kidHut.followRec(rec);
      let followPermDrop = this.kidHut.followRec(permRec);
      
      return Drop(null, () => {
        
        for (let perm of perms) {
          this.recPerms[rec.uid][perm]--;
          if (this.recPerms[rec.uid][perm] === 0) delete this.recPerms[rec.uid][perm];
        }
        if (this.recPerms[rec.uid].isEmpty()) {
          delete this.recPerms[rec.uid];
          permRec.dry();
        }
        followDrop.dry();
        
      });
      
    },
    attemptMod: function({ road, srcHut, msg, reply }) {
      
      if (!U.isType(msg, Object)) throw Error(`Invalid message`);
      if (!msg.has('recUid')) throw Error(`Missing "recUid" param`);
      if (!msg.has('value')) throw Error(`Missing "value" param`);
      if (!this.parHut.allRecs.has(msg.recUid)) throw Error(`No Rec with uid "${msg.recUid}"`);
      if (!this.recPerms.has(msg.recUid)) throw Error(`No permissions for Rec with uid ${msg.recUid}`);
      if (!this.recPerms[msg.recUid].has('set')) throw Error(`No "set" permission for rec with uid ${msg.recUid}`);
      
      this.parHut.allRecs.get(msg.recUid).setVal(msg.value);
      
    },
    attemptAdd: function({ road, srcHut, msg, reply }) {
      
      if (!U.isType(msg, Object)) throw Error(`Invalid message`);
      if (!msg.has('recUid')) throw Error(`Missing "recUid" param`);
      if (!msg.has('relName')) throw Error(`Missing "relName" param`);
      if (!this.parHut.allRecs.has(msg.recUid)) throw Error(`No Rec with uid "${msg.recUid}"`);
      if (!this.recPerms.has(msg.recUid)) throw Error(`No permissions for Rec with uid ${msg.recUid}`);
      if (!this.recPerms[msg.recUid].has(`add:${msg.relName}`)) throw Error(`No "add:${msg.relName}" permission for rec with uid ${msg.recUid}`);
      
      let rec = this.parHut.allRecs.get(msg.recUid);
      let newRec = this.parHut.createRec(msg.relName, { [rec.type.name]: rec, 'author': srcHut });
      
    },
    attemptRem: function({ road, srcHut, msg, reply }) {
      
      if (!U.isType(msg, Object)) throw Error(`Invalid message`);
      if (!msg.has('recUid')) throw Error(`Missing "recUid" param`);
      if (!this.parHut.allRecs.has(msg.recUid)) throw Error(`No Rec with uid "${msg.recUid}"`);
      if (!this.recPerms.has(msg.recUid)) throw Error(`No permissions for Rec with uid ${msg.recUid}`);
      if (!this.recPerms[msg.recUid].has(`rem`)) throw Error(`No "rem" permission for rec with uid ${msg.recUid}`);
      
      this.parHut.allRecs.get(msg.recUid).dry();
      
    },
    cleanup: function() { for (let route of this.routes) route.dry(); }
    
  })});
  let Node = U.inspire({ name: 'Node', insps: { Tmp }, methods: (insp, Insp) => ({
    
    init: function(parent, name, elem=null) {
      
      insp.Drop.init.call(this);
      this.parent = parent;
      this.name = name;
      this.dryMs = 2000;
      
      if (!parent) {
        this.domElem = elem || document.body;
        this.domElem.classList.add('ready');
      } else {
        this.domElem = elem || document.createElement('div');
        this.domElem.classList.add(this.name.replace(/[.]/g, '-'));
      }
      
      if (parent) parent.domElem.appendChild(this.domElem);
      
    },
    cleanup: async function() {
      
      this.domElem.classList.add('drying');
      this.domElem.style.height = `${this.domElem.getBoundingClientRect().height}px`;
      
      await Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      
      this.domElem.classList.add('dry');
      setTimeout(() => this.domElem.remove(), this.dryMs);
      
    }
    
  })});
  let render = (parHut, rec, parentNode=Node(null, 'root', document.body), seen=Set()) => {
    
    let basin = Basin();
    if (rec.type.name === 'perm.perm') { basin.dry(); return basin; }
    
    let circ = seen.has(rec);
    seen.add(rec);
    basin.add(Drop(null, () => seen.rem(rec)));
    
    let recNode = basin.add(Node(parentNode, rec.type.name));
    recNode.domElem.classList.add('rec');
    
    let titleNode = Node(recNode, 'title');
    titleNode.domElem.innerHTML = `${rec.type.name} (${rec.uid})`;
    
    let valueNode = Node(recNode, 'value');
    let displayNode = Node(valueNode, 'display');
    let controlNode = Node(recNode, 'control');
    let childrenNode = Node(recNode, 'children');
    
    // Update DOM when Rec value changes
    basin.add(rec.valSrc.route(value => displayNode.domElem.innerHTML = U.isType(value, String) ? value : JSON.stringify(value)));
    
    // Recursively render all children for all terms within
    if (!circ) basin.add(rec.relTermSrc.route(relTerm => {
      basin.add(RecScope(rec, relTerm, (childRec, dep) => dep(render(parHut, childRec, childrenNode, seen))));
    }));
    
    // Make DOM changes when permissions change
    let permDrops = {};
    
    basin.add(RecScope(rec, 'perm.perm/rec?', (perm, dep) => {
      
      console.log(`${rec.type.name} has perms: ${JSON.stringify(perm.val)}`);
      
      dep(perm.route(perms => {
        
        let removedPerms = { ...permDrops };
        for (let k in perms) {
          
          // Some perms look like "add:room.type"
          let [ perm, ...params ] = k.split(':');
          
          // This perm isn't being removed
          delete removedPerms[perm];
          
          // If the perm has been seen, skip it
          if (permDrops.has(k)) continue;
          
          permDrops[k] = ({
            set: () => {
              
              recNode.domElem.classList.add('set');
              let editorNode = null;
              let clickToEditFn = () => {
                
                if (editorNode) return;
                editorNode = Node(valueNode, 'editor');
                let editNode = Node(editorNode, 'edit', document.createElement('input'));
                let submitNode = Node(editorNode, 'submit');
                editNode.domElem.value = rec.val;
                editNode.domElem.focus();
                
                let doneEditFn = evt => {
                  if (!editorNode) return;
                  evt.preventDefault();
                  evt.stopPropagation();
                  Permissions.mod(parHut, rec, editNode.domElem.value);
                  editorNode.dry();
                  editorNode = null;
                };
                editNode.domElem.addEventListener('input', () => {
                  Permissions.mod(parHut, rec, editNode.domElem.value);
                });
                
                editNode.domElem.addEventListener('keydown', evt => evt.ctrlKey && evt.keyCode === 13 && doneEditFn(evt));
                submitNode.domElem.addEventListener('click', doneEditFn);
                
              };
              valueNode.domElem.addEventListener('click', clickToEditFn);
              return Drop(null, () => {
                recNode.classList.remove('set');
                valueNode.domElem.removeEventListener('click', clickToEditFn);
                if (editorNode) editorNode.dry();
              });
              
            },
            add: relName => {
              let addNode = Node(controlNode, 'add');
              addNode.domElem.classList.add(relName.replace(/[.]/g, '-'));
              addNode.domElem.addEventListener('click', () => Permissions.add(parHut, rec, relName));
              addNode.domElem.innerHTML = `+${relName}`;
              
              return Drop(null, () => addNode.dry());
            },
            rem: () => {
              recNode.domElem.classList.add('rem');
              let remNode = Node(recNode, 'rem');
              remNode.domElem.addEventListener('click', () => Permissions.rem(parHut, rec));
              
              return Drop(null, () => {
                recNode.domElem.classList.remove('rem');
                remNode.dry();
              });
            }
          })[perm](...params);
          
        }
        
        removedPerms.each(drop => drop.dry());
        
      }));
      
    }));
    
    if (circ) childrenNode.innerHTML = 'Omitting children for circular Rec';
    
    return basin;
    
  };
  
  return { Permissions, render };
  
};
