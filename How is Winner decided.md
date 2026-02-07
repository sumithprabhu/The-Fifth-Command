# 🧮 Game Winner Calculation Formula

## 🎯 Step-by-Step Formula

Let:
- **C1, C2, C3, C4, C5** = the 5 selected cards  
- Each card has stats:  
  - **Attack (A)**
  - **Defense (D)**
  - **Strategy (S)**  
  All out of 10.

---

### 1️⃣ Select Top 2 Attackers


Attackers = top 2 cards by Attack value
AttackScore = (A1 + A2) / 20 × 100


---

### 2️⃣ Select Top 2 Defenders (from remaining 3)


Defenders = next top 2 cards by Defense value
DefenseScore = (D1 + D2) / 20 × 100


---

### 3️⃣ Select 1 Strategist (remaining last card)


Strategist = remaining card
StrategyScore = (S1 / 10) × 100


---

### 4️⃣ Final Team Score


FinalScore = (AttackScore × 0.35) + (DefenseScore × 0.35) + (StrategyScore × 0.30)

Score out of 100.

---

## 🧩 Example 1

| Card | Attack | Defense | Strategy |
|------|---------|----------|-----------|
| C1 | 9 | 6 | 4 |
| C2 | 8 | 7 | 5 |
| C3 | 7 | 9 | 6 |
| C4 | 5 | 8 | 4 |
| C5 | 6 | 5 | 9 |

**Top Attackers:** C1 (9), C2 (8)  
**Top Defenders:** C3 (9), C4 (8)  
**Strategist:** C5 (9)



AttackScore = (9 + 8) / 20 × 100 = 85
DefenseScore = (9 + 8) / 20 × 100 = 85
StrategyScore = (9 / 10) × 100 = 90
FinalScore = (85×0.35) + (85×0.35) + (90×0.30) = 86.75


✅ **Final Team Score = 86.75 / 100**

---

## 🧩 Example 2

| Card | Attack | Defense | Strategy |
|------|---------|----------|-----------|
| C1 | 10 | 4 | 6 |
| C2 | 8 | 8 | 5 |
| C3 | 6 | 10 | 4 |
| C4 | 7 | 9 | 3 |
| C5 | 4 | 5 | 10 |

**Top Attackers:** C1 (10), C2 (8)  
**Top Defenders:** C3 (10), C4 (9)  
**Strategist:** C5 (10)



AttackScore = (10 + 8)/20×100 = 90
DefenseScore = (10 + 9)/20×100 = 95
StrategyScore = (10/10)×100 = 100
FinalScore = (90×0.35)+(95×0.35)+(100×0.30)=94.25


✅ **Final Team Score = 94.25 / 100**
