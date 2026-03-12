from database import get_db_connection
from psycopg2.extras import RealDictCursor

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