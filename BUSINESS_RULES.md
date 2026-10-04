# Business · Arcade Indian-city edition

This is an **original Arcade house edition** of a cash-based Indian-style
property game. It is **not** a reproduction of a manufacturer's board,
property cards, artwork or instruction sheet; prices, city arrangement, rent
table, cards and optional variants below were designed for Arcade. The
currently sold [Funskool Business: The Gold Quest](https://funskoolindia.com/product/business-the-gold-quest-game/)
is a **different resource-and-target-card game**, not this property game.
Its [manufacturer instruction sheet](https://www.funskoolindia.com/wp-content/uploads/2024/09/4935300-Business-Game-The-Gold-Quest_Instruction-Sheet_V1.pdf)
does not establish rules for classic cash-based Business.

## At the table

Choose 2–6 players. Each begins at Start with **₹15,000**. The default
40-space board is navigated clockwise with two six-sided dice. Passing or
landing on Start pays **₹1,500**, once per traversal; exact landing pays an
*additional* ₹1,500 only when that optional house rule is on. An unowned
deed can be bought for its listed price. Declining (or lacking the cash)
opens an ascending, all-seat auction, **including the decliner**. A bid must
exceed the current bid, be at least ₹1, and be affordable in cash; passing
removes the bidder from this auction. If no one bids the bank keeps the
deed. An auction-only setup option skips direct purchase.

On doubles, finish resolving the space and roll again. A **third consecutive
double sends you directly to Jail**, without moving on the third throw.
Jailed players still own, trade, build and collect rent. Before rolling they
may pay the selected fine (default **₹500**) or use a transferable retained
Jail Free card. Otherwise doubles release and move them without a bonus
roll. After three failed attempts the fine is mandatory *before* that
third roll's movement; raise cash, trade or declare bankruptcy if needed.
An optional roll-12 opening rule requires a total of 12 to enter; the
successful opening roll ends that turn at Start. Rest Stop has no effect
unless optional pooled-fees jackpot is enabled. Default Income Tax is
**₹200**, City Levy **₹300**; defaults are Arcade choices, not manufacturer
certifications. With the jackpot option, bank payments fund the pool,
collected by landing on Rest Stop.

Rent is paid by a player landing on another owner's **unmortgaged** deed.
Complete an unmortgaged color group to double its undeveloped base rent and
buy buildings: develop every city in that group **evenly** (lowest level
first; when selling, highest first). Each city can hold four houses, then
one hotel. A hotel replaces and returns four houses; downgrading requires
four available bank houses. There are only **32 houses and 12 hotels** in
the bank. If multiple eligible developers compete for the last building,
it goes to an ascending auction with bids at least the building cost; its
winner places it on a legal owned city. If a hotel cannot downgrade because
the house bank is empty, the owner may liquidate **all buildings in the
color group** directly for half their total cost. Ordinary building sales
return half the building price, one level at a time. Building management is
available outside the owner's own turn except during another unresolved
response or auction.

Mortgaging a deed pays **half its printed price**; first clear *every
building in its color group*. No mortgaged deed earns rent; no color group
with a mortgage may build. Repayment is principal plus **10% of mortgage
principal** (rounded up to a whole rupee). Two players may propose, reject,
accept, withdraw or counter a trade containing cash, unimproved deeds and
retained Jail Free cards. A receiving player immediately pays the bank
**10% of the mortgage principal** for each incoming mortgaged deed; trade
acceptance is atomic and fails if either side lacks cash, deeds, cards or
the transfer interest. Neither player may trade a city while its color
group contains buildings.

Fortune and City Fund each have 12 original shuffled cards: payments,
collections, movement, repairs, each-player effects, Jail and retained
Jail Free cards. Drawn cards cycle through a discard pile; retained cards
are unavailable to the deck until used or surrendered. Card moves obey
Start salary and resolve the destination. Each-player effects settle
**sequentially** before the turn continues; debts interrupt rather than
skip remaining effects. Cash balances, deeds, bids and card *holdings* are
public. Only the future draw order is hidden from guests.

If you cannot pay, sell buildings, mortgage deeds or make a solvent trade.
The payment continues when you have enough cash. Bankruptcy transfers
remaining cash, buildings' sale proceeds, deeds and cards to an individual
creditor; mortgaged deeds cost that creditor immediate transfer interest.
Bank creditors return retained cards to their decks and auction the
unmortgaged bank deeds. Subsequent debt or elimination resolves before
play resumes. The last solvent player wins. Optionally stop after a fixed
number of **completed turns** (not a wall-clock timer); compare net worth:
**cash + full printed value of unmortgaged deeds + half printed value of
mortgaged deeds + full original building investment (5 building units
for a hotel)**. Equal top totals share the win.

## Arcade board prices and rents

The 22 city spaces use these eight Arcade groups:

| Group | Cities (printed prices, ₹) | Each building (₹) |
| --- | --- | ---: |
| Indigo | Pune 60 · Nagpur 60 | 50 |
| Sky | Surat 100 · Vadodara 100 · Ahmedabad 120 | 50 |
| Rose | Jaipur 140 · Udaipur 140 · Jodhpur 160 | 100 |
| Saffron | Lucknow 180 · Kanpur 180 · Varanasi 200 | 100 |
| Crimson | Hyderabad 220 · Visakhapatnam 220 · Vijayawada 240 | 150 |
| Gold | Chennai 260 · Coimbatore 260 · Madurai 280 | 150 |
| Green | Bengaluru 300 · Mysuru 300 · Mangaluru 320 | 200 |
| Navy | Mumbai 350 · New Delhi 400 | 200 |

For any printed city price **P**, rents by level (none / 1 / 2 / 3 / 4
houses / hotel) are `P/10, P/2, 3P, 9P, 16P, 25P` in rupees. An
unimproved complete color group doubles its first value. Four rail
deeds (Western, Southern, Eastern, Northern) cost ₹200 each and charge
₹25/₹50/₹100/₹200 when their owner has 1/2/3/4 rails.
Power Grid and Water Works cost ₹150 each; rent is four times the rolled
total with one utility or ten times with both. The remaining board spaces
are Start (0), City Fund (2/17/33), Income Tax (4), Fortune (7/22/36),
Jail/Visiting (10), Rest Stop (20), Go to Jail (30), City Levy (38).
See `games/business-engine.js:BOARD` for the exact numbered city placement.

## Research and edition distinctions (October 2026)

No verified single rulebook for a classic cash-based Indian Business edition
was located. Secondary descriptions at
[IndiaFantasy](https://www.indiafantasy.com/games/casual-games/business-game-rules-all-you-need-to-know/)
and [Gurugamer](https://gurugamer.com/reviews/how-to-play-business-game-all-the-basic-rules-of-business-game-10079)
agree about ₹15,000 starting cash, ₹1,500 salary, extra rolls on doubles,
three doubles to Jail, auctions and even building, but they do not verify
this board's values. Gurugamer describes ₹200 jail and ₹200 income tax;
[TeenPatti](https://www.teenpatti.com/how-to-play-business-game/)
instead reports ₹500 jail and ₹2,000 tax and internally conflicts about
Rest/club effects. Sources also disagree on player range and roll-12
opening. Arcade provides explicit defaults and selected toggles rather than
claiming any one variant is universally official.
