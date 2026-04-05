from database import get_db_connection
from psycopg2.extras import RealDictCursor
import psycopg2
import psycopg2.extensions

def execute_query(query, params=None, fetchall=True):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(query, params)
        return cur.fetchall() if fetchall else cur.fetchone()
    except Exception as e:
        print(f"Database error: {e}")
        return []
    finally:
        cur.close()
        conn.close()

def execute_modify(query, params=None):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(query, params)
        conn.commit()
        return True, "Success"
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally:
        cur.close()
        conn.close()

# --- ADMIN PANEL QUERIES ---
def get_grids(): return execute_query("SELECT grid_id, grid_name, location FROM power_grid ORDER BY grid_id")
def get_areas(): return execute_query("SELECT area_id, zone, city, grid_id, poc FROM distribution_area ORDER BY area_id")
def get_consumers(): return execute_query("SELECT consumer_id, full_name, permanent_address as address, age FROM consumer ORDER BY consumer_id")
def get_connections():
    return execute_query("""
        SELECT connection_id, consumer_id, area_id, connection_type, 
               load_assign as load, TO_CHAR(installation_date, 'YYYY-MM-DD') as install_date, status 
        FROM connection ORDER BY connection_id
    """)
def get_readings():
    return execute_query("""
        SELECT reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed 
        FROM meter_reading ORDER BY reading_id
    """)
def get_bills():
    return execute_query("""
        SELECT bill_id, consumer_id, connection_id, billing_month as month, units_consumed as units, 
               amount, payment_status as status, TO_CHAR(due_date, 'YYYY-MM-DD') as due_date 
        FROM bill ORDER BY bill_id
    """)

# --- COMPLEX RELATIONAL QUERY FOR THE MODAL ---
def get_consumer_full_details(consumer_id):
    """Joins Consumer, Connection, Area, and Grid tables for the Admin view"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # 1. Get Basic Profile
        cur.execute("SELECT * FROM consumer WHERE consumer_id = %s", (consumer_id,))
        consumer = cur.fetchone()
        
        # 2. Get Deep Relational Data
        cur.execute("""
            SELECT c.connection_id, c.connection_type, c.load_assign, c.status,
                   d.zone, d.city, p.grid_name
            FROM connection c
            JOIN distribution_area d ON c.area_id = d.area_id
            JOIN power_grid p ON d.grid_id = p.grid_id
            WHERE c.consumer_id = %s
        """, (consumer_id,))
        connections = cur.fetchall()
        
        return {"consumer": consumer, "connections": connections}
    except Exception as e:
        print(e)
        return None
    finally:
        cur.close()
        conn.close()

# --- ANALYTICS QUERIES ---
def get_analytics_top_areas():
    return execute_query("""
        SELECT d.zone, SUM(m.units_consumed) as total_units
        FROM meter_reading m
        JOIN connection c ON m.connection_id = c.connection_id
        JOIN distribution_area d ON c.area_id = d.area_id
        GROUP BY d.zone ORDER BY total_units DESC LIMIT 5
    """)
def get_analytics_power_loss():
    return execute_query("""
        SELECT d.zone, d.city, s.units_supplied, COALESCE(SUM(m.units_consumed), 0) as units_consumed,
        (s.units_supplied - COALESCE(SUM(m.units_consumed), 0)) as power_loss
        FROM area_monthly_supply s
        JOIN distribution_area d ON s.area_id = d.area_id
        LEFT JOIN connection c ON d.area_id = c.area_id
        LEFT JOIN meter_reading m ON c.connection_id = m.connection_id AND s.supply_month = m.billing_month
        GROUP BY d.zone, d.city, s.units_supplied ORDER BY power_loss DESC
    """)

# --- CONSUMER PORTAL QUERIES ---
def get_consumer_dashboard(consumer_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT COUNT(*) as total_conns FROM connection WHERE consumer_id = %s", (consumer_id,))
        conns = cur.fetchone()['total_conns']
        cur.execute("SELECT COUNT(*) as unpaid_bills, COALESCE(SUM(amount), 0) as total_due FROM bill WHERE consumer_id = %s AND payment_status != 'Paid'", (consumer_id,))
        bills_info = cur.fetchone()
        return {"total_connections": conns, "unpaid_bills": bills_info['unpaid_bills'], "total_due": bills_info['total_due']}
    except Exception as e:
        return {"total_connections": 0, "unpaid_bills": 0, "total_due": 0}
    finally:
        cur.close()
        conn.close()

def get_consumer_connections(consumer_id):
    return execute_query("SELECT connection_id, address, connection_type, load_assign as load, TO_CHAR(installation_date, 'YYYY-MM-DD') as install_date, status FROM connection WHERE consumer_id = %s ORDER BY connection_id", (consumer_id,))

def get_consumer_bills(consumer_id):
    return execute_query("SELECT bill_id, connection_id, billing_month as month, units_consumed as units, amount, payment_status as status, TO_CHAR(due_date, 'YYYY-MM-DD') as due_date FROM bill WHERE consumer_id = %s ORDER BY bill_id DESC", (consumer_id,))

# --- ADD / DELETE QUERIES ---
def delete_record(table, id_column, record_id):
    return execute_modify(f"DELETE FROM {table} WHERE {id_column} = %s", (record_id,))

def add_grid(grid_id, grid_name, location):
    return execute_modify("INSERT INTO power_grid (grid_id, grid_name, location) VALUES (%s, %s, %s)", (grid_id, grid_name, location))

def add_consumer(consumer_id, name, address, age):
    return execute_modify("INSERT INTO consumer (consumer_id, full_name, permanent_address, age) VALUES (%s, %s, %s, %s)", (consumer_id, name, address, age))

# ── APPLICATION 1: generate_bill_for_reading ────────────────────────
from datetime import date, timedelta

def generate_bill_for_reading(reading_id, connection_id, billing_month,
                               previous_reading, current_reading, bill_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Step 1: validate connection is Active
        cur.execute("SELECT connection_id, consumer_id, connection_type, status FROM connection WHERE connection_id = %s", (connection_id,))
        conn_row = cur.fetchone()
        if not conn_row:
            raise ValueError(f"Connection {connection_id} does not exist.")
        if conn_row['status'] != 'Active':
            raise ValueError(f"Connection {connection_id} is not Active.")

        consumer_id = conn_row['consumer_id']
        connection_type = conn_row['connection_type']
        units_consumed = current_reading - previous_reading

        # Step 2: no duplicate reading for same month
        cur.execute("SELECT 1 FROM meter_reading WHERE connection_id = %s AND billing_month = %s", (connection_id, billing_month))
        if cur.fetchone():
            raise ValueError(f"Reading for {billing_month} already exists.")

        # Step 3: insert meter reading
        cur.execute("INSERT INTO meter_reading (reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed) VALUES (%s, %s, %s, %s, %s, %s)",
                    (reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed))

        # Step 4: find tariff slab
        cur.execute("SELECT slab_id, rate_per_unit, fixed_charge FROM tariff_slab WHERE LOWER(consumer_category) = LOWER(%s) AND %s BETWEEN unit_from AND unit_to AND effective_to IS NULL LIMIT 1",
                    (connection_type, units_consumed))
        slab = cur.fetchone()
        if not slab:
            raise ValueError(f"No tariff slab found for {connection_type}, {units_consumed} units.")

        # Step 5: calculate + insert bill
        bill_amount = round(units_consumed * float(slab['rate_per_unit']) + float(slab['fixed_charge']), 2)
        due_date = date.today() + timedelta(days=15)
        cur.execute("INSERT INTO bill (bill_id, consumer_id, connection_id, slab_id, billing_month, units_consumed, amount, payment_status, generated_on, due_date) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    (bill_id, consumer_id, connection_id, slab['slab_id'], billing_month, units_consumed, bill_amount, 'Unpaid', date.today(), due_date))

        conn.commit()
        return {'success': True, 'bill_amount': bill_amount, 'due_date': str(due_date),
                'message': f'Bill of Rs.{bill_amount} generated for {billing_month}.'}
    except ValueError as ve:
        conn.rollback()
        return {'success': False, 'message': str(ve)}
    except Exception as e:
        conn.rollback()
        return {'success': False, 'message': f'DB Error: {str(e)}'}
    finally:
        cur.close()
        conn.close()

# ── APPLICATION 2: get_consumer_bill_analysis ───────────────────────
def get_consumer_bill_analysis(consumer_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT consumer_id, full_name, permanent_address, age FROM consumer WHERE consumer_id = %s", (consumer_id,))
        consumer = cur.fetchone()
        if not consumer:
            return {'success': False, 'message': 'Consumer not found.'}

        cur.execute("""SELECT b.bill_id, b.billing_month, b.units_consumed, b.amount,
                              b.payment_status, TO_CHAR(b.due_date,'YYYY-MM-DD') AS due_date,
                              ts.rate_per_unit, ts.consumer_category
                       FROM bill b JOIN tariff_slab ts ON b.slab_id = ts.slab_id
                       WHERE b.consumer_id = %s ORDER BY b.billing_month DESC""", (consumer_id,))
        bill_history = cur.fetchall()

        cur.execute("""SELECT COUNT(*) AS total_bills, COALESCE(SUM(amount),0) AS total_spend,
                              COALESCE(AVG(amount),0) AS avg_bill, COALESCE(MAX(amount),0) AS highest_bill,
                              COALESCE(MIN(amount),0) AS lowest_bill, COALESCE(SUM(units_consumed),0) AS total_units,
                              COUNT(*) FILTER (WHERE payment_status='Overdue') AS overdue_count,
                              COUNT(*) FILTER (WHERE payment_status='Unpaid')  AS unpaid_count
                       FROM bill WHERE consumer_id = %s""", (consumer_id,))
        stats = cur.fetchone()

        cur.execute("""SELECT conn.connection_id, conn.connection_type,
                              SUM(mr.units_consumed) AS total_units, COUNT(mr.reading_id) AS reading_count
                       FROM connection conn JOIN meter_reading mr ON conn.connection_id = mr.connection_id
                       WHERE conn.consumer_id = %s GROUP BY conn.connection_id, conn.connection_type
                       ORDER BY total_units DESC""", (consumer_id,))
        breakdown = cur.fetchall()

        return {'success': True, 'consumer': dict(consumer),
                'bill_history': [dict(b) for b in bill_history],
                'stats': dict(stats),
                'consumption_breakdown': [dict(c) for c in breakdown]}
    except Exception as e:
        return {'success': False, 'message': f'DB Error: {str(e)}'}
    finally:
        cur.close()
        conn.close()
# ── TASK 6 FUNCTION 1: pay_bill_transaction() ─────────────────────
# PURPOSE : Demonstrates an explicit DB transaction from Python.
#           Uses REPEATABLE READ isolation level to prevent dirty reads.
#           Acquires a row-level lock with FOR UPDATE so no other
#           session can modify the bill mid-transaction.
#           If bill is already paid → clean rollback with clear message.
# MAPS TO : Consumer Portal → Pay Bill button
# ─────────────────────────────────────────────────────────────────

def pay_bill_transaction(bill_id):
    conn = get_db_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Set isolation level BEFORE any query — prevents dirty reads
        conn.set_isolation_level(
            psycopg2.extensions.ISOLATION_LEVEL_REPEATABLE_READ
        )

        # Step 1: Lock the row — no other transaction can update
        #         this bill until we COMMIT or ROLLBACK
        cur.execute(
            "SELECT bill_id, amount, payment_status FROM bill "
            "WHERE bill_id = %s FOR UPDATE",
            (bill_id,)
        )
        bill = cur.fetchone()

        if not bill:
            raise ValueError(f"Bill {bill_id} not found.")
        if bill['payment_status'] == 'Paid':
            raise ValueError(f"Bill {bill_id} is already paid. No changes made.")

        # Step 2: Mark as Paid with exact timestamp
        cur.execute(
            "UPDATE bill SET payment_status = 'Paid', paid_on = NOW() "
            "WHERE bill_id = %s",
            (bill_id,)
        )

        conn.commit()  # ← COMMIT: change is now permanent
        return {
            'success'  : True,
            'bill_id'  : bill_id,
            'amount'   : float(bill['amount']),
            'message'  : f"Bill {bill_id} of Rs.{bill['amount']} marked as Paid."
        }

    except ValueError as ve:
        conn.rollback()  # ← ROLLBACK: undo any partial changes
        return {'success': False, 'message': str(ve)}
    except Exception as e:
        conn.rollback()
        return {'success': False, 'message': f'DB Error: {str(e)}'}
    finally:
        cur.close()
        conn.close()


# ── TASK 6 FUNCTION 2: transfer_connection_area() ─────────────────
# PURPOSE : Demonstrates a multi-step transaction with SAVEPOINT.
#           Moves a connection from one distribution area to another.
#           If the new area does not exist → rollback to savepoint,
#           keeping the connection's load update but undoing the
#           area change. Shows partial rollback in Python.
# MAPS TO : Admin Panel → Edit Connection
# ─────────────────────────────────────────────────────────────────

def transfer_connection_area(connection_id, new_area_id, new_load):
    conn = get_db_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    try:
        conn.set_isolation_level(
            psycopg2.extensions.ISOLATION_LEVEL_READ_COMMITTED
        )

        # Step 1: Update the load assignment (valid change)
        cur.execute(
            "UPDATE connection SET load_assign = %s WHERE connection_id = %s",
            (new_load, connection_id)
        )

        # Create a savepoint after the valid update
        cur.execute("SAVEPOINT sp_load_updated")

        # Step 2: Check if new_area_id actually exists
        cur.execute(
            "SELECT area_id FROM distribution_area WHERE area_id = %s",
            (new_area_id,)
        )
        area = cur.fetchone()

        if not area:
            # Rollback only the area change, keep the load update
            cur.execute("ROLLBACK TO SAVEPOINT sp_load_updated")
            conn.commit()
            return {
                'success' : False,
                'message' : f"Area {new_area_id} not found. "
                            f"Load updated to {new_load} but area unchanged.",
                'partial' : True
            }

        # Step 3: Move the connection to the new area
        cur.execute(
            "UPDATE connection SET area_id = %s WHERE connection_id = %s",
            (new_area_id, connection_id)
        )

        conn.commit()
        return {
            'success' : True,
            'message' : f"Connection {connection_id} moved to area "
                        f"{new_area_id} with load {new_load}."
        }

    except Exception as e:
        conn.rollback()
        return {'success': False, 'message': f'DB Error: {str(e)}'}
    finally:
        cur.close()
        conn.close()
