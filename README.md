# ⚡ Smart Power Distribution & Consumption Analytics System

---

## 📌 Project Overview

The Smart Power Distribution & Consumption Analytics System is a full-stack, database-driven application designed to model, manage, and analyze electricity distribution and consumption at a city level.

The system tracks electricity flow across:

Power Grids → Distribution Areas → Consumers → Smart Meters → Billing

The project emphasizes:

- Strong relational design & normalization  
- Data integrity and transaction safety  
- Automated billing logic  
- Analytical SQL queries  
- Backend API integration  
- UI-based system interaction  

---

## 🎯 Project Objectives

- Maintain accurate electricity distribution records  
- Track monthly smart meter readings  
- Generate electricity bills automatically  
- Analyze area-wise power consumption  
- Detect electricity losses  
- Ensure consistency during concurrent operations  

---

## 🧱 System Modules

### 🔌 Grid & Area Management  
Power grids, distribution areas, and monthly electricity supply tracking.

### 👤 Consumer & Connection Management  
Consumer records, area mapping, and connection types.

### 📟 Smart Meter Readings  
Monthly readings with validation and automated consumption calculation.

### 💰 Billing System  
Tariff slabs and automated bill generation.

### 📈 Analytics  
Consumption trends, loss detection, and operational insights.

---

## ✅ Project Task Status

| Task | Description | Status |
|-----|------------|-------|
| Task 1 | Business scope & requirements | ✅ Completed |
| Task 2 | Conceptual & relational design | ✅ Completed |
| Task 3 | Schema, constraints, indexes & data insertion | ✅ Completed |
| Task 4 | Analytical SQL queries | ⏳ In Progress |
| Task 5 | Triggers & backend logic | ⏳ Upcoming |
| Task 6 | Transactions & concurrency handling | ⏳ Upcoming |

---

## 🗄 Database Design Highlights

### ✔ Normalized Tables
power_grid, distribution_area, consumer, connection, meter_reading, tariff_slab, bill

### ✔ Integrity Constraints
- Foreign keys with cascade rules  
- Reading consistency checks  
- Non-negative usage enforcement  
- Billing date validations  

### ✔ Performance Optimization
- Case-insensitive unique indexes  
- Query acceleration indexes  

---

## 🛠 Tech Stack

### Backend
- Python  
- Flask (REST API layer)

### Database
- PostgreSQL  

### Frontend
- HTML5  
- CSS3  
- JavaScript  
- React.js *(UI in progress)*  

### Tools
- Git & GitHub  
- PostgreSQL CLI / pgAdmin  

---


