import { createShell, wireBack } from '../js/game-shell.js';
import { celebrate } from '../js/celebration.js';

// A curated, offline practice vocabulary. Every listed word can be a guess or answer.
export const WORDS = `ABOUT ABOVE ACORN ACTOR ACUTE ADAPT ADORE ADULT AFTER AGAIN AGENT AGILE AGREE AHEAD AISLE ALARM ALBUM ALERT ALIEN ALIVE ALLEY ALLOW ALONE ALONG ALTER AMBER ANGEL ANGER ANGLE ANGRY APPLE APPLY APRON ARGUE ARISE ARMOR AROMA ARROW ASIDE ASSET AVOID AWAKE AWARD AWARE BACON BADGE BAKER BASIC BEACH BEARD BEAST BEGIN BELOW BENCH BERRY BIRTH BLACK BLADE BLAME BLANK BLAST BLAZE BLEND BLESS BLIND BLOCK BLOOM BOARD BOOST BOUND BRAIN BRAKE BRAND BRAVE BREAD BREAK BREED BRICK BRIDE BRIEF BRING BROAD BROKE BROWN BRUSH BUILD BUILT CABIN CABLE CAMEL CANDY CARRY CATCH CAUSE CHAIN CHAIR CHALK CHARM CHART CHASE CHEAP CHEAT CHECK CHEEK CHEER CHESS CHEST CHIEF CHILD CHILL CHINA CHORD CLAIM CLASS CLEAN CLEAR CLERK CLIMB CLOCK CLOSE CLOUD COACH COAST COCOA COLOR COMET CORAL COUCH COULD COUNT COURT COVER CRAFT CRANE CRASH CRAWL CRAZY CREAM CREEK CRISP CROSS CROWD CROWN CURVE DANCE DEALT DEATH DELAY DEPTH DIARY DIRTY DOUBT DOUGH DRAFT DRAIN DRAMA DRAWN DREAM DRESS DRIFT DRINK DRIVE DROVE EAGER EAGLE EARLY EARTH EIGHT ELBOW ELDER ELECT ELITE EMPTY ENJOY ENTER ENTRY EQUAL ERROR EVENT EVERY EXACT EXTRA FAINT FAIRY FAITH FALSE FANCY FAULT FEAST FENCE FERRY FETCH FEVER FIELD FIERY FIGHT FINAL FIRST FLAME FLASH FLEET FLESH FLOAT FLOOR FLOUR FLUID FOCUS FORCE FORGE FORTH FOUND FRAME FRESH FRONT FROST FRUIT FUNNY GHOST GIANT GIVEN GLASS GLOBE GLORY GLOVE GOING GRACE GRADE GRAIN GRAND GRANT GRAPE GRAPH GRASP GRASS GRAVE GREAT GREEN GREET GRIEF GROUP GROWN GUARD GUESS GUEST GUIDE HABIT HAPPY HASTE HEART HEAVY HEDGE HELLO HONEY HORSE HOTEL HOUSE HUMAN HUMOR IDEAL IMAGE IMPLY INDEX INNER INPUT IRONY IVORY JELLY JEWEL JOINT JUDGE JUICE KNIFE KNOCK KNOWN LABEL LARGE LASER LATER LAUGH LAYER LEARN LEASE LEAST LEAVE LEMON LEVEL LIGHT LILAC LIMIT LINEN LIVER LOCAL LODGE LOGIC LOOSE LOVER LOWER LUCKY LUNCH MAGIC MAJOR MAKER MANGO MARCH MATCH MAYOR MEDAL MERCY MERIT METAL MIGHT MINOR MODEL MONEY MONTH MORAL MOTOR MOUNT MOUSE MOUTH MOVIE MUSIC NERVE NEVER NIGHT NOBLE NOISE NORTH NOVEL NURSE OCEAN OFFER OFTEN OLIVE ONION OPERA ORBIT ORDER OTHER OTTER OUGHT OUTER OWNER PAINT PANEL PAPER PARTY PASTE PATCH PAUSE PEACE PEACH PEARL PEDAL PENNY PHASE PHONE PHOTO PIANO PIECE PILOT PITCH PIXEL PIZZA PLACE PLAIN PLANE PLANT PLATE PLAZA POINT POLAR POUND POWER PRESS PRICE PRIDE PRIME PRINT PRIZE PROOF PROUD PROVE PULSE PUPPY QUEEN QUEST QUICK QUIET QUITE QUOTE RADIO RAISE RALLY RANGE RAPID RATIO REACH READY REALM REBEL REFER RELAX REPLY RIDER RIDGE RIGHT RIGID RIVER ROAST ROBOT ROCKY ROUGH ROUND ROUTE ROYAL RUGBY RULER RURAL SADLY SALAD SAUCE SCALE SCARE SCENE SCENT SCOPE SCORE SCOUT SENSE SERVE SEVEN SHADE SHAKE SHALL SHAME SHAPE SHARE SHARK SHARP SHEEP SHEER SHEET SHELF SHELL SHIFT SHINE SHIRT SHOCK SHOOT SHORE SHORT SHOUT SHOWN SIGHT SILLY SINCE SKILL SLATE SLEEP SLICE SLIDE SMALL SMART SMELL SMILE SMOKE SNAKE SNEAK SOLAR SOLID SOLVE SORRY SOUND SOUTH SPACE SPADE SPARE SPARK SPEAK SPEED SPELL SPEND SPICE SPIKE SPILL SPINE SPLIT SPOKE SPOON SPORT SPRAY SQUAD STACK STAFF STAGE STAIR STAKE STAMP STAND STARE START STATE STEAM STEEL STEEP STEER STICK STILL STOCK STONE STOOD STORE STORM STORY STOVE STRAP STRAW STRIP STUCK STUDY STUFF STYLE SUGAR SUITE SUNNY SUPER SWEET SWIFT SWING SWORD TABLE TAKEN TASTE TEACH TEETH THANK THEIR THEME THERE THESE THICK THIEF THING THINK THIRD THOSE THREE THREW THROW THUMB TIGER TIGHT TIRED TITLE TODAY TOKEN TOPIC TOTAL TOUCH TOUGH TOWER TRACE TRACK TRADE TRAIL TRAIN TRAIT TREAT TREND TRIAL TRIBE TRICK TRIED TROOP TRUCK TRULY TRUNK TRUST TRUTH TWICE TWIST UNCLE UNDER UNION UNITY UNTIL UPPER UPSET URBAN USAGE USUAL VALID VALUE VIDEO VISIT VITAL VOICE VOTER WAGON WASTE WATCH WATER WEARY WEAVE WEIGH WEIRD WHEAT WHEEL WHERE WHICH WHILE WHITE WHOLE WHOSE WIDTH WITCH WOMAN WOMEN WORLD WORRY WORTH WOULD WOUND WRITE WRONG WROTE YACHT YEARN YEAST YIELD YOUNG YOUTH ZEBRA`.split(' ');
const dictionary = new Set(WORDS);
export function evaluateGuess(guess, answer) {
  const marks = Array(5).fill('absent'), remaining = answer.split('');
  for (let i = 0; i < 5; i++) if (guess[i] === answer[i]) { marks[i] = 'correct'; remaining[i] = null; }
  for (let i = 0; i < 5; i++) if (marks[i] !== 'correct') {
    const j = remaining.indexOf(guess[i]);
    if (j >= 0) { marks[i] = 'present'; remaining[j] = null; }
  }
  return marks;
}
export function validState(s) {
  return !!s && dictionary.has(s.answer) && Array.isArray(s.guesses) && s.guesses.length < 6 && s.guesses.every(g => dictionary.has(g) && g !== s.answer);
}
export default {
  async render(el, game, { navigate, session } = {}) {
    const shell = createShell(el, game, { meta: 'Five letters · six guesses · offline practice' });
    if (navigate) wireBack(shell, navigate);
    const { stage } = shell; stage.classList.add('new-game');
    let s = validState(session?.state) ? structuredClone(session.state) : null;
    let input = '', message = '', over = false;
    const board = document.createElement('div'); board.className = 'wordle-board'; board.setAttribute('aria-label', 'Guess board');
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    const form = document.createElement('form'); form.className = 'wordle-form';
    const field = document.createElement('input'); field.maxLength = 5; field.autocomplete = 'off'; field.spellcheck = false; field.autocapitalize = 'characters'; field.setAttribute('aria-label', 'Five letter guess');
    const submit = document.createElement('button'); submit.className = 'game-ui-action'; submit.textContent = 'Guess';
    form.append(field, submit);
    const keyboard = document.createElement('div'); keyboard.className = 'wordle-keyboard'; keyboard.setAttribute('aria-label', 'Letter keyboard');
    const legend = document.createElement('p'); legend.textContent = '✓ Correct spot · ↔ Wrong spot · × Not in word. Uses a curated offline word list.';
    stage.append(board, status, form, keyboard, legend);
    function draw() {
      over = s.guesses.includes(s.answer) || s.guesses.length === 6;
      board.replaceChildren();
      for (let row = 0; row < 6; row++) {
        const guess = s.guesses[row], letters = guess || (row === s.guesses.length ? input : '');
        const marks = guess ? evaluateGuess(guess, s.answer) : [];
        const line = document.createElement('div'); line.className = 'wordle-row';
        for (let i = 0; i < 5; i++) {
          const tile = document.createElement('span'); tile.className = 'wordle-tile ' + (marks[i] || '');
          tile.textContent = letters[i] || ''; tile.setAttribute('aria-label', letters[i] ? `${letters[i]}: ${marks[i] || 'unsubmitted'}` : 'Empty');
          if (marks[i]) { const mark = document.createElement('small'); mark.textContent = { correct: '✓', present: '↔', absent: '×' }[marks[i]]; mark.setAttribute('aria-hidden', 'true'); tile.append(mark); }
          line.append(tile);
        }
        board.append(line);
      }
      status.textContent = over ? (s.guesses.includes(s.answer) ? `Solved in ${s.guesses.length}! The word is ${s.answer}.` : `The word was ${s.answer}. Try another!`) : message || `Guess ${s.guesses.length + 1} of 6`;
      field.disabled = submit.disabled = over;
      const ranks = { absent: 1, present: 2, correct: 3 }, keys = {};
      for (const guess of s.guesses) evaluateGuess(guess, s.answer).forEach((mark,i) => { if ((ranks[keys[guess[i]]] || 0) < ranks[mark]) keys[guess[i]] = mark; });
      keyboard.replaceChildren();
      for (const letters of ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']) {
        const row = document.createElement('div'); row.className = 'wordle-key-row';
        for (const letter of letters) {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'wordle-key ' + (keys[letter] || ''); b.textContent = letter; b.setAttribute('aria-label', `${letter}${keys[letter] ? ': ' + keys[letter] : ''}`); b.disabled = over;
          b.addEventListener('click', () => { if (input.length < 5) input += letter; message = ''; field.value = input; draw();
            [...keyboard.querySelectorAll('button')].find(key => key.textContent === letter)?.focus({ preventScroll: true }); }); row.append(b);
        }
        keyboard.append(row);
      }
      const back = document.createElement('button'); back.type = 'button'; back.className = 'game-ui-action game-ui-action--secondary'; back.textContent = 'Delete letter'; back.disabled = over;
      back.addEventListener('click', () => { input = input.slice(0,-1); message = ''; field.value = input; draw();
        [...keyboard.querySelectorAll('button')].find(key => key.textContent === 'Delete letter')?.focus({ preventScroll: true }); }); keyboard.append(back);
      if (over) session?.finish(); else session?.save(s);
    }
    field.addEventListener('input', () => { input = field.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0,5); field.value = input; message = ''; draw(); });
    form.addEventListener('submit', event => {
      event.preventDefault(); if (over) return;
      if (input.length !== 5) { message = 'Enter five letters.'; draw(); return; }
      if (!dictionary.has(input)) { message = 'That word is outside this practice word list. Try another.'; draw(); return; }
      const won = input === s.answer; s.guesses.push(input); input = ''; field.value = ''; message = ''; draw();
      if (won) celebrate(shell.root, 'Word solved!');
    });
    function reset() { s = { answer: WORDS[Math.floor(Math.random() * WORDS.length)], guesses: [] }; input = ''; field.value = ''; message = ''; shell.root.querySelector('.arcade-victory')?.remove(); draw(); }
    shell.getResetButton().addEventListener('click', reset);
    if (s) draw(); else reset();
    const again = document.createElement('button'); again.type = 'button'; again.className = 'game-ui-action game-ui-action--secondary'; again.textContent = 'New word'; again.addEventListener('click', reset); stage.append(again);
    return { dispose() {} };
  },
};
