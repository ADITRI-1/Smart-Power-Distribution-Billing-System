from database import get_db_connection
from psycopg2.extras import RealDictCursor
import psycopg2

def execute_query(query, params=None, fetchall=True):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(query, params)
        return cur.fetchall() if fetchall else cur.fetchone()
    except Exception as e: return []
    finally: cur.close(); conn.close()

def execute_modify(query, params=None):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(query, params)
        conn.commit()
        return True, "Operation successful!"
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        return False, "Error: This ID (or a unique value) already exists in the system!"
    except psycopg2.errors.ForeignKeyViolation:
        conn.rollback()
        return False, "Error: You referenced an ID that does not exist!"
    except psycopg2.errors.CheckViolation:
        conn.rollback()
        return False, "Error: A data constraint was violated."
    except Exception as e:
        conn.rollback()
        return False, f"Database Error: {str(e)}"
    finally: cur.close(); conn.close()

def create_consumer_user(full_name, username, hashed_password):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT MAX(consumer_id) FROM consumer")
        max_id = cur.fetchone()[0]
        new_id = (max_id + 1) if max_id else 1000
        cur.execute("INSERT INTO consumer (consumer_id, full_name, permanent_address, age) VALUES (%s, %s, %s, %s)", (new_id, full_name, 'Pending Address', 18))
        cur.execute("INSERT INTO consumer_users (consumer_id, username, password_hash) VALUES (%s, %s, %s)", (new_id, username, hashed_password))
        conn.commit()
        return True, "Account created"
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally: cur.close(); conn.close()

def get_user_login_data(username, login_type):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if login_type == 'admin':
            cur.execute("SELECT password_hash FROM admin_users WHERE username = %s", (username,))
            res = cur.fetchone()
            if res: res['role'] = 'admin'; return res
        elif login_type == 'consumer':
            cur.execute("SELECT password_hash, consumer_id FROM consumer_users WHERE username = %s", (username,))
            res = cur.fetchone()
            if res: res['role'] = 'consumer'; return res
        return None
    finally: cur.close(); conn.close()

def get_grids(): return execute_query("SELECT grid_id, grid_name, location FROM power_grid ORDER BY grid_id")
def get_areas(): return execute_query("SELECT area_id, zone, city, grid_id, poc FROM distribution_area ORDER BY area_id")
def get_consumers(): return execute_query("SELECT consumer_id, full_name, permanent_address as address, age FROM consumer ORDER BY consumer_id")
def get_connections(): return execute_query("SELECT connection_id, consumer_id, area_id, connection_type, load_assign as load, TO_CHAR(installation_date, 'YYYY-MM-DD') as install_date, status FROM connection ORDER BY connection_id")
def get_readings(): return execute_query("SELECT reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed FROM meter_reading ORDER BY reading_id DESC")
def get_bills(): return execute_query("SELECT bill_id, consumer_id, connection_id, billing_month as month, units_consumed as units, amount, payment_status as status, TO_CHAR(due_date, 'YYYY-MM-DD') as due_date FROM bill ORDER BY due_date DESC, bill_id DESC")

def add_grid(grid_id, grid_name, location): return execute_modify("INSERT INTO power_grid (grid_id, grid_name, location) VALUES (%s, %s, %s)", (grid_id, grid_name, location))
def add_area(area_id, grid_id, zone, city, poc): return execute_modify("INSERT INTO distribution_area (area_id, grid_id, zone, city, poc) VALUES (%s, %s, %s, %s, %s)", (area_id, grid_id, zone, city, poc))
def add_consumer(consumer_id, name, address, age, username, password_hash):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # 1. Create the base consumer profile
        cur.execute("""
            INSERT INTO consumer (consumer_id, full_name, permanent_address, age) 
            VALUES (%s, %s, %s, %s)
        """, (consumer_id, name, address, age))
        
        # 2. Create their login credentials linked to that profile
        cur.execute("""
            INSERT INTO consumer_users (consumer_id, username, password_hash) 
            VALUES (%s, %s, %s)
        """, (consumer_id, username, password_hash))
        
        conn.commit()
        return True, "Consumer and Login Profile created successfully!"
    except Exception as e:
        conn.rollback() # If username is taken or ID exists, cancel everything safely
        return False, str(e)
    finally:
        cur.close()
        conn.close()
def update_grid(grid_id, name, location): return execute_modify("UPDATE power_grid SET grid_name=%s, location=%s WHERE grid_id=%s", (name, location, grid_id))
def update_area(area_id, zone, city, grid_id, poc): return execute_modify("UPDATE distribution_area SET zone=%s, city=%s, grid_id=%s, poc=%s WHERE area_id=%s", (zone, city, grid_id, poc, area_id))
def update_consumer(consumer_id, name, address, age): return execute_modify("UPDATE consumer SET full_name=%s, permanent_address=%s, age=%s WHERE consumer_id=%s", (name, address, age, consumer_id))
def update_connection(connection_id, consumer_id, area_id, type, load, status): return execute_modify("UPDATE connection SET consumer_id=%s, area_id=%s, connection_type=%s, load_assign=%s, status=%s WHERE connection_id=%s", (consumer_id, area_id, type, load, status, connection_id))

def add_connection(connection_id, consumer_id, area_id, address, conn_type, load, install_date, status): 
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO connection (connection_id, consumer_id, area_id, address, connection_type, load_assign, installation_date, status) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)", (connection_id, consumer_id, area_id, address, conn_type, load, install_date, status))
        baseline_month = str(install_date)[:7] + "-Base"
        cur.execute("INSERT INTO meter_reading (reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed) VALUES (nextval('reading_id_seq'), %s, %s, 0, 0, 0)", (connection_id, baseline_month))
        conn.commit()
        return True, "Connection created with baseline reading of 0."
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally: cur.close(); conn.close()

def add_meter_reading(connection_id, billing_month, previous_reading, current_reading):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT status FROM connection WHERE connection_id = %s", (connection_id,))
        c = cur.fetchone()
        if not c or c[0] != 'Active': raise ValueError("Connection inactive/invalid.")
        cur.execute("INSERT INTO meter_reading (reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed) VALUES (nextval('reading_id_seq'), %s, %s, %s, %s, 0)", (connection_id, billing_month, previous_reading, current_reading))
        conn.commit()
        return {'success': True, 'message': 'Reading logged! Bill auto-generated.'}
    except Exception as e:
        conn.rollback()
        return {'success': False, 'message': str(e)}
    finally: cur.close(); conn.close()

def delete_record(table, id_column, record_id): 
    return execute_modify(f"DELETE FROM {table} WHERE {id_column} = %s", (record_id,))

def pay_bill_transaction(bill_id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT amount, payment_status FROM bill WHERE bill_id = %s FOR UPDATE", (bill_id,))
        bill = cur.fetchone()
        if not bill or bill[1] == 'Paid': raise ValueError("Already paid or missing.")
        cur.execute("UPDATE bill SET payment_status = 'Paid', paid_on = NOW() WHERE bill_id = %s", (bill_id,))
        conn.commit()
        return {'success': True, 'message': "Payment successful."}
    except Exception as e:
        conn.rollback()
        return {'success': False, 'message': str(e)}
    finally: cur.close(); conn.close()

def get_admin_dashboard_stats():
    return execute_query("SELECT (SELECT COUNT(*) FROM power_grid) as total_grids, (SELECT COUNT(*) FROM distribution_area) as total_areas, (SELECT COUNT(*) FROM consumer) as total_consumers, (SELECT COUNT(*) FROM connection) as total_connections, (SELECT COALESCE(SUM(units_supplied), 0) FROM area_monthly_supply) as total_units_supplied", fetchall=False)

def get_consumer_full_details(consumer_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT * FROM consumer WHERE consumer_id = %s", (consumer_id,))
        c = cur.fetchone()
        cur.execute("SELECT c.connection_id, c.connection_type, c.load_assign, c.status, d.zone, d.city, p.grid_name FROM connection c JOIN distribution_area d ON c.area_id = d.area_id JOIN power_grid p ON d.grid_id = p.grid_id WHERE c.consumer_id = %s", (consumer_id,))
        return {"consumer": c, "connections": cur.fetchall()}
    except: return None
    finally: cur.close(); conn.close()

def get_analytics_top_areas():
    return execute_query("""
        SELECT d.zone, COALESCE(SUM(m.units_consumed), 0)::FLOAT as total_units 
        FROM meter_reading m 
        JOIN connection c ON m.connection_id = c.connection_id 
        JOIN distribution_area d ON c.area_id = d.area_id 
        GROUP BY d.zone 
        ORDER BY total_units DESC LIMIT 5
    """)

def get_analytics_power_loss():
    return execute_query("""
        WITH area_supply AS (
            SELECT area_id, COALESCE(SUM(units_supplied), 0)::FLOAT as total_supplied
            FROM area_monthly_supply
            GROUP BY area_id
        ),
        area_consumed AS (
            SELECT c.area_id, COALESCE(SUM(m.units_consumed), 0)::FLOAT as total_consumed
            FROM meter_reading m
            JOIN connection c ON m.connection_id = c.connection_id
            GROUP BY c.area_id
        )
        SELECT d.zone, d.city, 
               COALESCE(s.total_supplied, 0)::FLOAT as units_supplied, 
               COALESCE(c.total_consumed, 0)::FLOAT as units_consumed, 
               (COALESCE(s.total_supplied, 0) - COALESCE(c.total_consumed, 0))::FLOAT as power_loss 
        FROM distribution_area d 
        LEFT JOIN area_supply s ON d.area_id = s.area_id 
        LEFT JOIN area_consumed c ON d.area_id = c.area_id 
        ORDER BY power_loss DESC
    """)
def get_consumer_dashboard(consumer_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT COUNT(*) as total_conns FROM connection WHERE consumer_id = %s", (consumer_id,))
        conns = cur.fetchone()['total_conns']
        cur.execute("SELECT COUNT(*) as unpaid_bills, COALESCE(SUM(amount), 0) as total_due FROM bill WHERE consumer_id = %s AND payment_status != 'Paid'", (consumer_id,))
        b = cur.fetchone()
        return {"total_connections": conns, "unpaid_bills": b['unpaid_bills'], "total_due": b['total_due']}
    except: return {"total_connections": 0, "unpaid_bills": 0, "total_due": 0}
    finally: cur.close(); conn.close()

def get_consumer_connections(consumer_id): return execute_query("SELECT connection_id, address, connection_type, load_assign as load, TO_CHAR(installation_date, 'YYYY-MM-DD') as install_date, status FROM connection WHERE consumer_id = %s ORDER BY connection_id", (consumer_id,))
def get_consumer_bills(consumer_id): return execute_query("SELECT bill_id, connection_id, billing_month as month, units_consumed as units, amount, payment_status as status, TO_CHAR(due_date, 'YYYY-MM-DD') as due_date FROM bill WHERE consumer_id = %s ORDER BY bill_id DESC", (consumer_id,))


def get_consumer_profile(consumer_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT c.consumer_id, c.full_name, c.permanent_address, c.age, u.username
            FROM consumer c JOIN consumer_users u ON c.consumer_id = u.consumer_id
            WHERE c.consumer_id = %s
        """, (consumer_id,))
        return cur.fetchone()
    finally: cur.close(); conn.close()

def update_consumer_profile(consumer_id, name, address, age, new_password_hash=None):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("UPDATE consumer SET full_name=%s, permanent_address=%s, age=%s WHERE consumer_id=%s", (name, address, age, consumer_id))
        if new_password_hash:
            cur.execute("UPDATE consumer_users SET password_hash=%s WHERE consumer_id=%s", (new_password_hash, consumer_id))
        conn.commit()
        return True, "Profile updated successfully!"
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally: cur.close(); conn.close()