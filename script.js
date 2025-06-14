(function(){
  const storageKey = 'webmemo-tests';
  let tests = loadTests();
  renderTests();

  document.getElementById('addTestBtn').addEventListener('click', () => {
    const name = document.getElementById('testName').value.trim();
    const file = document.getElementById('csvInput').files[0];
    if (!name || !file) return alert('名前とCSVを指定してください');
    const reader = new FileReader();
    reader.onload = e => {
      const cards = parseCSV(e.target.result);
      const test = { id: genId(), name, cards, children: [] };
      tests.push(test);
      saveTests();
      renderTests();
      document.getElementById('testName').value = '';
      document.getElementById('csvInput').value = '';
    };
    reader.readAsText(file);
  });

  document.getElementById('runTestBtn').addEventListener('click', () => {
    const file = document.getElementById('csvInput').files[0];
    if(!file) return alert('CSVを指定してください');
    const reader = new FileReader();
    reader.onload = e => startSimpleTest(parseCSVForTest(e.target.result));
    reader.readAsText(file);
  });

  function loadTests(){
    try { return JSON.parse(localStorage.getItem(storageKey)) || []; }
    catch(e){ return []; }
  }

  function saveTests(){
    localStorage.setItem(storageKey, JSON.stringify(tests));
  }

  function genId(){
    return 't' + Math.random().toString(36).substr(2,9);
  }

  function parseCSV(text){
    const lines = text.trim().split(/\r?\n/);
    const cards = [];
    for(const line of lines){
      const [q,a,m,learned,hide,review] = line.split(',');
      cards.push({q,a,m,status:{learned:learned==='true',hide:hide==='true',review:review==='true'}});
    }
    return cards;
  }

  function parseCSVForTest(text){
    const lines = text.trim().split(/\r?\n/);
    if(lines.length < 2) return [];
    const headers = lines[0].split(',');
    const qIdx = headers.indexOf('問題');
    const aIdx = headers.indexOf('答え');
    const cards = [];
    for(let i=1;i<lines.length;i++){
      const cols = lines[i].split(',');
      cards.push({q: cols[qIdx] || '', a: cols[aIdx] || ''});
    }
    return cards;
  }

  function renderTests(){
    const ul = document.getElementById('testList');
    ul.innerHTML = '';
    tests.forEach(t => ul.appendChild(renderTestItem(t)));
  }

  function renderTestItem(test){
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = test.name;
    span.style.cursor = 'pointer';
    span.addEventListener('click', () => runTest(test));
    li.appendChild(span);

    const del = document.createElement('button');
    del.textContent = '削除';
    del.addEventListener('click', () => { if(confirm('削除しますか?')){ deleteTest(test.id); } });
    li.appendChild(del);

    if(test.children && test.children.length){
      const childUl = document.createElement('ul');
      test.children.forEach(c => childUl.appendChild(renderTestItem(c)));
      li.appendChild(childUl);
    }
    return li;
  }

  function deleteTest(id){
    tests = tests.filter(t => t.id !== id);
    tests.forEach(t => removeChild(t,id));
    saveTests();
    renderTests();
  }

  function removeChild(test,id){
    if(!test.children) return;
    test.children = test.children.filter(c => c.id !== id);
    test.children.forEach(c => removeChild(c,id));
  }

  // Test Runner
  let currentTest = null;
  let idx = 0;
  let showAnswer = false;

  const area = document.getElementById('testArea');
  const cardDiv = document.getElementById('card');
  const memoDiv = document.getElementById('memo');
  const statusDiv = document.getElementById('status');

  function runTest(test){
    currentTest = JSON.parse(JSON.stringify(test)); // clone
    idx = 0;
    showAnswer = false;
    area.classList.remove('hidden');
    displayCard();
    document.addEventListener('keydown', handleKey);
  }

  function displayCard(){
    if(!currentTest.cards.length){
      endTest();
      return;
    }
    const card = currentTest.cards[idx];
    cardDiv.textContent = showAnswer ? card.a : card.q;
    memoDiv.textContent = card.m || '';
    statusDiv.textContent = `覚えた:${card.status.learned} 非表示:${card.status.hide} 見直す:${card.status.review}`;
  }

  function handleKey(e){
    const key = e.key;
    if(key==='j'){ prev(); }
    else if(key==='k'){ next(); }
    else if(key==='o'){ toggle('learned'); }
    else if(key==='n'){ toggle('hide'); }
    else if(key==='a'){ toggle('review'); }
    else if(key==='q'){ endTest(); }
    else if(key==='s'){ idx = 0; showAnswer=false; displayCard(); }
    else if(key==='e'){ area.classList.add('hidden'); document.removeEventListener('keydown',handleKey); }
    else { showAnswer = !showAnswer; displayCard(); }
  }

  function prev(){
    if(showAnswer){
      showAnswer = false;
    }else{
      if(idx > 0){
        idx--;
        showAnswer = true;
      }
    }
    displayCard();
  }

  function next(){
    if(!showAnswer){
      showAnswer = true;
    }else{
      if(idx < currentTest.cards.length - 1){
        idx++;
        showAnswer = false;
      }
    }
    displayCard();
  }

  function toggle(key){
    const card = currentTest.cards[idx];
    card.status[key] = !card.status[key];
    displayCard();
  }

  function endTest(){
    document.removeEventListener('keydown',handleKey);
    if(confirm('結果を保存しますか?')){
      const result = JSON.parse(JSON.stringify(currentTest));
      result.id = genId();
      result.name = currentTest.name + ' 結果';
      addSubtest(tests, currentTest.id, result);
      saveTests();
      renderTests();
    }
    area.classList.add('hidden');
  }

  function addSubtest(list, id, sub){
    for(const t of list){
      if(t.id === id){
        t.children = t.children || [];
        t.children.push(sub);
        return true;
      }
      if(t.children && addSubtest(t.children, id, sub)) return true;
    }
    return false;
  }

  // Simple Test Mode ----------------------------------
  let simpleCards = [];
  let simpleIdx = 0;
  let simpleShowAnswer = false;

  function startSimpleTest(cards){
    if(!cards.length) return alert('カードがありません');
    simpleCards = cards;
    simpleIdx = 0;
    simpleShowAnswer = false;
    memoDiv.textContent = '';
    statusDiv.textContent = '';
    area.classList.remove('hidden');
    displaySimpleCard();
    document.addEventListener('keydown', handleSimpleKey);
  }

  function displaySimpleCard(){
    const c = simpleCards[simpleIdx];
    cardDiv.textContent = simpleShowAnswer ? c.a : c.q;
  }

  function handleSimpleKey(e){
    if(e.key === 'k'){
      if(simpleShowAnswer){
        simpleIdx++;
        if(simpleIdx >= simpleCards.length){
          endSimpleTest();
          return;
        }
        simpleShowAnswer = false;
      }else{
        simpleShowAnswer = true;
      }
      displaySimpleCard();
    }else if(e.key === 'j'){
      if(simpleShowAnswer){
        simpleShowAnswer = false;
      }else{
        if(simpleIdx > 0){
          simpleIdx--;
          simpleShowAnswer = true;
        }
      }
      displaySimpleCard();
    }else if(e.key === 'q'){
      endSimpleTest();
    }
  }

  function endSimpleTest(){
    document.removeEventListener('keydown', handleSimpleKey);
    area.classList.add('hidden');
  }
})();
