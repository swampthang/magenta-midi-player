class MidiPlayer {
  
  constructor(mainWrapper, container, midiFile) {
    // set up properties
    this.mainWrapper = document.querySelector(mainWrapper);
    this.container = document.querySelector(container);
    this.midiFile = midiFile;
    this.player;
    this.vizPlayer; 
    this.seq; 
    this.ds; 
    this.sorted;
    this.leftLine;
    this.rightLine;
    this.loopBtn;
    this.loopSelector;
    this.loopRect;
    this.minLoopArea = 50;

    // create a main container
    this.mainContainer = this.createMainContainer()
    // this.getFile = this.createFileSelector()

    // move the passed container into the main container
    this.mainContainer.appendChild(this.container)

    // add an svg into the passed container
    this.svg = this.createVisualizerContainer()

    // create the buttons wrapper
    this.buttons = this.createButtonWrapper()

    // create the buttons and tempo slider
    this.playBtn = this.createButton('play')
    this.pauseBtn = this.createButton('pause')
    this.rewindBtn = this.createButton('rewind')
    this.loopBtn = this.createButton('loop')
    this.tempoSlider = this.createTempoSlider()

    this.loadFile()
  }

  // magenta functions ////////////////////////////////////////
  loadFile() {
    mm.blobToNoteSequence(this.midiFile).then((s) => {
      this.seq = s;
      this.tempoSlider.value = Math.round(this.seq.tempos[0].qpm)
      this.loadSequence()
      this.buttons.classList.remove('hide')
    }).catch((reason) => {
        alert('Failed to load MIDI file.');
        console.error(reason);
    });
  }

  checkPlayers() {
    console.log(players)
    if( players !== undefined ) {
      for( let obj of players ) {
        if( obj !== this && obj.player.isPlaying ) {
          obj.player.stop()
        }
      }
    }
  }

  loadSequence() {

    let that = this;

    const config = {
      noteHeight: 6,
      pixelsPerTimeStep: 26,  // like a note width
      noteSpacing: 1,
      noteRGB: '218, 227, 229',
      activeNoteRGB: '4, 8, 15',
    }
    this.player = new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus');
    this.vizPlayer = new mm.PianoRollSVGVisualizer(this.seq, this.container.querySelector('svg'), config);
    this.vizPlayer.scrollIntoViewIfNeeded(true)
  
    this.ds = new DragSelect({
      selectables: that.container.querySelectorAll(`.note`),
      area: this.svg
    });
  
    this.ds.subscribe('callback', ({ items }) => {
      that.sorted = items.sort((a, b) => a.dataset.index - b.dataset.index)
      if( that.sorted.length === 0 ) return;
      that.setLoopParams(that.sorted)
    })
  
    this.player.callbackObject = {
      run(note) { 
        that.vizPlayer.redraw(note, true)
      },
      stop() {}
    }
    this.loopSelector = this.createLoopSelector()
    this.setListeners()

    // init the player so loop will work first time
    this.handlePlay()
  }

  setLoopParams(selectedItems = $(this.viz).find('.note.ds-selected')) {
    if( selectedItems.length === 0 ) return;
    let start = selectedItems[0].dataset.index
    let end = selectedItems[selectedItems.length-1].dataset.index
    
    mm.Player.tone.Transport.loop = true
    let sx = this.seq.notes[start].startTime;
    let ex = this.seq.notes[end].endTime;

    const toggleSeek = () => {
      this.player.seekTo(ex)
      this.player.seekTo(sx)
    }

    if( this.player.getPlayState() === 'paused' ) {
      toggleSeek()
    } else if( this.player.isPlaying() ) {
      this.player.pause();
      toggleSeek()
    }
    mm.Player.tone.Transport.loopStart = sx;
    mm.Player.tone.Transport.loopEnd = ex;
  }

  setSelectables({x1,x2}) {

    let all = this.ds.getSelectables()
    let select = [];
    let deselect = [];

    all.forEach((note) => {
      let x = parseFloat(note.getAttribute('x')),
          xx = parseFloat(note.getAttribute('width')) + x;
      if( x >= x1 && xx <= x2 ) {
        select.push(note)
      } else {
        deselect.push(note)
      }
    })
    this.ds.removeSelection(deselect)
    this.sorted = select.sort((a, b) => a.dataset.index - b.dataset.index)
    // this.sorted = select.sort((a, b) => parseFloat(a.getAttribute('x')) - parseFloat(b.getAttribute('x')))
    this.ds.addSelection(select)
    this.setLoopParams(this.sorted)
  }

  resetDrag(d) {
    setTimeout(() => {
      let wd = parseFloat(this.loopRect.getAttribute("width")),
          diff = this.minLoopArea - wd;

      if (d.target.className.baseVal === "left") {
        gsap.set(this.leftLine, { x: `-=${diff}` });
        gsap.set(this.loopRect, {attr: { x: `-=${diff}` }})
      } else {
        gsap.set(this.rightLine, { x: `+=${diff}` });
      }
      gsap.set(rect, { attr: { width: this.minLoopArea } });
      d.enable();
    }, 200);
  };

  handlePlay() {
    this.checkPlayers()
    if( this.player.getPlayState() === 'paused' ) {
      this.player.resume()
    } else {
      if( mm.Player.tone.Transport.loop ) {
        // start playing from the first note of the loop
        this.player.start(this.seq, null, mm.Player.tone.Transport.loopStart)
      } else {
        this.player.start(this.seq)
      }
    }
    this.playBtn.classList.add('hide')
    this.pauseBtn.classList.remove('hide')
  }

  handleDragSelection() {
    // let x1 = parseFloat(this.loopRect.getAttribute('x')) + gsap.getProperty(this.loopRect,'x');
    let x1 = parseFloat(this.loopRect.getAttribute('x'));
    let x2 = x1 + parseFloat(this.loopRect.getAttribute('width'));
    this.setSelectables({x1,x2})
  }

  // setListeners ////////////////////////////////////////////////////
  setListeners() {
    let that = this;

    this.playBtn.addEventListener('click', (e) => {
      this.pauseBtn.classList.add('active')
      this.handlePlay()
    })
    
    this.pauseBtn.addEventListener('click', (e) => {
      e.target.classList.remove('active')
      this.player.pause()
      this.playBtn.classList.remove('hide')
      this.pauseBtn.classList.add('hide')
    })
    
    this.rewindBtn.addEventListener('click', () => {
      if( this.player.isPlaying ) {
        this.player.stop();
        this.playBtn.classList.remove('hide')
        this.pauseBtn.classList.add('hide')
        this.pauseBtn.classList.remove('active')
        // this.vizPlayer.clearActiveNotes()
        // this.ds.clearSelection()
        this.container.scrollLeft = 0;
      }
    })

    this.loopBtn.addEventListener('click', () => {

      if( this.loopSelector.classList.contains('hide') ) {
        this.loopBtn.classList.add('active')
        if( this.player.isPlaying ) {
          this.player.stop()
          this.playBtn.classList.remove('hide')
          this.pauseBtn.classList.add('hide')
        }
        mm.Player.tone.Transport.loop = true;
        this.loopSelector.classList.remove('hide')
        let selected = this.ds.getSelection()
        this.ds.removeSelection(selected)
      } else {
        this.loopBtn.classList.remove('active')
        mm.Player.tone.Transport.loop = false;
        this.loopSelector.classList.add('hide')
        let selected = this.ds.getSelection()
        this.ds.removeSelection(selected)
      }
    })
    
    this.tempoSlider.addEventListener('input', (e)=>{
      this.player.setTempo(parseInt(e.target.value))
      let selectedItems = $(this.viz).find('.note.ds-selected')
      if( selectedItems.length > 0 ) {
        // this.sorted = selectedItems.sort((a, b) => a.dataset.index - b.dataset.index)
        this.sorted = selectedItems.sort((a, b) => parseFloat(a.getAttribute('x')) - parseFloat(b.getAttribute('x')))
        this.setLoopParams(this.sorted)
      }
    })

    gsap.set(this.loopRect,{ svgOrigin: "0 0"})
    
    Draggable.create(this.leftLine,{
      zIndexBoost: false,
      force3D: false,
      type: "left",
      cursor: "ew-resize",
      bounds: that.container,
      onDrag: function() {
        if (_.round(parseFloat(that.loopRect.getAttribute("width")),2) < that.minLoopArea) {
          this.endDrag();
          resetDrag(this);
        }
        console.log(this.x)
        if( this.x === 0 ) {
          gsap.set([that.leftLine,that.loopRect], {attr: { x: 0 }});
        } else {
          gsap.set([that.leftLine,that.loopRect],{ attr: {x: `+=${this.deltaX}`}})
        }

        gsap.set(that.loopRect, {attr: { width: `-=${this.deltaX}` }});
        that.handleDragSelection()
      }
    })

    Draggable.create(this.rightLine,{
      zIndexBoost: false,
      force3D: false,
      type: "left",
      cursor: "ew-resize",
      bounds: that.container,
      onDrag: function() {
        if (_.round(parseFloat(that.loopRect.getAttribute("width")),2) < that.minLoopArea) {
          this.endDrag();
          resetDrag(this);
        }
        gsap.set(that.loopRect, { attr: { width: `+=${this.deltaX}` } });
        gsap.set(that.rightLine,{ attr: {x: `+=${this.deltaX}`}})
        that.handleDragSelection()
      }
    })

    Draggable.create(this.loopRect,{
      zIndexBoost: false,
      force3D: false,
      type: "left",
      bounds: that.container,
      onDrag: function() {
        gsap.set([that.leftLine, that.rightLine],{attr: { x: `+=${this.deltaX}` }})
        gsap.set(that.loopRect,{attr:{ x: `+=${this.deltaX}`}})
        that.handleDragSelection()
      }
    })
  }

  // constructor UI functions ////////////////////////////////////////
  createVisualizerContainer() {
    let vc = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    vc.setAttribute('class', 'viz')
    this.container.appendChild(vc)
    return vc;
  }

  createMainContainer() {
    let mc = document.createElement('div')
    mc.className = 'container d-flex flex-column bd-highlight my-4'
    let mainContainer = this.container.parentNode
    mainContainer.insertBefore(mc,this.container)
    return mc;
  }

  createButtonWrapper() {
    let wr = document.createElement('div')
    wr.className = 'buttons hide'
    this.mainContainer.appendChild(wr)
    return wr;
  }

  createButton(txt) {

    let btn = document.createElement('i')

    switch( txt ) {
      case 'pause':
        btn.className = `fa-solid fa-circle-pause active hide ${txt}`
      break;
      case 'play':
        btn.className = `fa-solid fa-circle-play ${txt}`
      break;
      case 'rewind':
        btn.className = `fa-solid fa-backward ${txt}`
      break;
      case 'loop':
        btn.className = `fa-solid fa-arrows-rotate ${txt}`
      break;
    }
  
    this.buttons.appendChild(btn)
    return btn;
  }

  createTempoSlider() {
    let ts = document.createElement('div')
    ts.className = 'tempo-settings'
    let lb = document.createElement('label')
    lb.textContent = 'Tempo'
    lb.className = 'mx-2'
    let sl = document.createElement('input')
    sl.className = 'tempo'
    sl.setAttribute('type','number')
    sl.setAttribute('min',1)
    sl.setAttribute('max', 300)
    sl.setAttribute('step',1)
    ts.appendChild(lb)
    ts.appendChild(sl)
    this.buttons.appendChild(ts)
    return sl;
  }

  createLoopSelector() {

    let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    let wd = this.container.offsetWidth
    let ht = this.container.offsetHeight - 40
    svg.setAttributeNS(null,'width',wd)
    svg.setAttributeNS(null,'height',ht)
    svg.setAttributeNS(null,'viewBox', `0 0 ${wd} ${ht}`)
    svg.setAttributeNS(null, 'class', 'mp-loop-area hide')
    let rect = document.createElementNS("http://www.w3.org/2000/svg", 'rect')
    rect.setAttributeNS(null, 'class', 'fill-area')
    rect.setAttributeNS(null, 'x', 0)
    rect.setAttributeNS(null,'width',wd)
    rect.setAttributeNS(null,'height',ht)
    rect.setAttributeNS(null,'fill','rgb(187, 209, 234)')
    rect.setAttributeNS(null,'opacity',0.1)
    rect.setAttributeNS(null, 'style', 'isolation:isolate')
    svg.appendChild(rect)
    this.loopRect = rect;
    let sides = [{side: 'left', x: 0},{side: 'right', x: wd - 2}]
    sides.forEach((line) =>{
      let l = document.createElementNS("http://www.w3.org/2000/svg",'rect')
      l.setAttributeNS(null,'class', line.side)
      l.setAttributeNS(null,'x', line.x)
      l.setAttributeNS(null,'width', 2)
      l.setAttributeNS(null,'height',ht)
      l.setAttributeNS(null,'fill', 'rgb(161, 198, 234)')
      if( line.side === 'left' ){
        this.leftLine = l
      } else {
        this.rightLine = l
      }
      svg.appendChild(l)
    })
    this.container.appendChild(svg)
    return svg
  }

  createFileSelector() {
    // file selector wrapper
    let fs = document.createElement('div')
    fs.className = 'file-select-wrapper input-group mb-3'
    // inner wrapper
    let cs = document.createElement('div')
    cs.className = 'custom-file'
    // input field that needs to be returned
    let gf = document.createElement('input')
    gf.setAttribute('type','file')
    gf.setAttribute('accept','.mid')
    // label
    let lb = document.createElement('label')
    lb.className = 'custom-file-label'
    lb.setAttribute('aria-describedby', 'getFileAddOn')
    lb.textContent = 'Choose midi file'
    cs.appendChild(lb)
    cs.appendChild(gf)
    fs.appendChild(cs)
    this.mainContainer.appendChild(fs)

    return gf;
  }
}