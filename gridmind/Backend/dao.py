from database import get_db_connection
from psycopg2.extras import RealDictCursor
import psycopg2
import random
import string
from datetime import datetime

def execute_query(query, params=None, fetchall=True):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(query, params)
        return cur.fetchall() if fetchall else cur.fetchone()
    except Exception as e: 
        print(f"Query Error: {e}")
        return []
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
        return False, "Error: This ID already exists in the system!"
    except psycopg2.errors.ForeignKeyViolation:
        conn.rollback()
        return False, "Error: Data is linked to another record and cannot be deleted/modified directly."
    except Exception as e:
        conn.rollback()
        return False, f"Database Error: {str(e)}"
    finally: cur.close(); conn.close()

# ==========================================
# LAZY UPDATE MECHANISM (Fixes the Overdue Bug)
# ==========================================
def check_and_update_overdue_bills():
    """Passively checks and updates bills that have crossed their due date."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("UPDATE bill SET payment_status = 'Overdue' WHERE payment_status = 'Unpaid' AND due_date < CURRENT_DATE")
        conn.commit()
    except:
        pass # Silently fail if DB is locked, it will catch it next time
    finally:
        cur.close()
        conn.close()

# ==========================================
# LOGIN & AUTHENTICATION
# ==========================================
def check_and_get_user(username, login_type):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        table = "admin_users" if login_type == "admin" else "consumer_users"
        id_field = "consumer_id" if login_type == "consumer" else "admin_id"
        cur.execute(f"SELECT password_hash, {id_field} FROM {table} WHERE username = %s", (username,))
        row = cur.fetchone()
        if not row: return None
        user = dict(row) # Convert to standard dict
        user['role'] = login_type
        return user
    finally: cur.close(); conn.close()

def update_admin_password(username, new_password_hash):
    return execute_modify("UPDATE admin_users SET password_hash = %s WHERE username = %s", (new_password_hash, username))

def generate_reset_token(email, login_type):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        table = "admin_users" if login_type == "admin" else "consumer_users"
        cur.execute(f"SELECT username FROM {table} WHERE email = %s", (email,))
        if not cur.fetchone(): return None 
        otp = ''.join(random.choices(string.digits, k=6))
        cur.execute(f"UPDATE {table} SET reset_token = %s, token_expiry = NOW() + INTERVAL '15 minutes' WHERE email = %s", (otp, email))
        conn.commit()
        return otp
    except Exception: return None
    finally: cur.close(); conn.close()

def reset_password_with_token(email, token, new_password_hash, login_type):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        table = "admin_users" if login_type == "admin" else "consumer_users"
        cur.execute(f"SELECT reset_token FROM {table} WHERE email = %s AND reset_token = %s AND token_expiry > NOW()", (email, token))
        if not cur.fetchone(): return False, "Invalid or expired OTP."
        cur.execute(f"UPDATE {table} SET password_hash = %s, reset_token = NULL, token_expiry = NULL WHERE email = %s", (new_password_hash, email))
        conn.commit()
        return True, "Password reset successfully."
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally: cur.close(); conn.close()

# ==========================================
# FETCH DATA
# ==========================================
def get_grids(): return execute_query("SELECT grid_id, grid_name, location FROM power_grid ORDER BY grid_id")
def get_areas(): return execute_query("SELECT area_id, zone, city, grid_id, poc FROM distribution_area ORDER BY area_id")
def get_consumers(): return execute_query("SELECT consumer_id, full_name, permanent_address as address, age FROM consumer ORDER BY consumer_id")
def get_connections(): 
    return execute_query("SELECT connection_id, consumer_id, area_id, connection_type, load_assign as load, TO_CHAR(installation_date, 'YYYY-MM-DD') as install_date, status FROM connection ORDER BY connection_id")
def get_readings(): return execute_query("SELECT reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed FROM meter_reading ORDER BY reading_id DESC")

def get_bills(): 
    check_and_update_overdue_bills() # Check for overdue bills before displaying
    return execute_query("""
        SELECT bill_id, COALESCE(consumer_id, 0) as consumer_id, COALESCE(connection_id, 0) as connection_id, 
        billing_month as month, units_consumed as units, amount, payment_status as status, 
        TO_CHAR(due_date, 'YYYY-MM-DD') as due_date 
        FROM bill ORDER BY due_date DESC, bill_id DESC
    """)

# ==========================================
# ADD & UPDATE DATA
# ==========================================
def add_grid(grid_id, grid_name, location): return execute_modify("INSERT INTO power_grid (grid_id, grid_name, location) VALUES (%s, %s, %s)", (grid_id, grid_name, location))
def add_area(area_id, grid_id, zone, city, poc): return execute_modify("INSERT INTO distribution_area (area_id, grid_id, zone, city, poc) VALUES (%s, %s, %s, %s, %s)", (area_id, grid_id, zone, city, poc))
def update_grid(grid_id, name, location): return execute_modify("UPDATE power_grid SET grid_name=%s, location=%s WHERE grid_id=%s", (name, location, grid_id))
def update_area(area_id, zone, city, grid_id, poc): return execute_modify("UPDATE distribution_area SET zone=%s, city=%s, grid_id=%s, poc=%s WHERE area_id=%s", (zone, city, grid_id, poc, area_id))
def update_consumer(consumer_id, name, address, age): return execute_modify("UPDATE consumer SET full_name=%s, permanent_address=%s, age=%s WHERE consumer_id=%s", (name, address, age, consumer_id))
def update_connection(connection_id, consumer_id, area_id, type, load, status): return execute_modify("UPDATE connection SET consumer_id=%s, area_id=%s, connection_type=%s, load_assign=%s, status=%s WHERE connection_id=%s", (consumer_id, area_id, type, load, status, connection_id))

def add_consumer(consumer_id, name, address, age, username, password_hash, email):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO consumer (consumer_id, full_name, permanent_address, age) VALUES (%s, %s, %s, %s)", (consumer_id, name, address, age))
        cur.execute("INSERT INTO consumer_users (consumer_id, username, password_hash, email) VALUES (%s, %s, %s, %s)", (consumer_id, username, password_hash, email))
        conn.commit()
        return True, "Consumer created successfully!"
    except Exception as e:
        conn.rollback() 
        return False, str(e)
    finally: cur.close(); conn.close()

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

# ==========================================
# READINGS & BILLING
# ==========================================
def add_meter_reading(connection_id, billing_month, previous_reading, current_reading):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        if billing_month > datetime.now().strftime('%Y-%m'): raise ValueError("Cannot log readings for future months.")
        cur.execute("SELECT status FROM connection WHERE connection_id = %s", (connection_id,))
        c = cur.fetchone()
        if not c or c[0] != 'Active': raise ValueError("Connection inactive/invalid.")
        cur.execute("DELETE FROM meter_reading WHERE connection_id = %s AND billing_month LIKE '%%-Base'", (connection_id,))
        cur.execute("INSERT INTO meter_reading (reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed) VALUES (nextval('reading_id_seq'), %s, %s, %s, %s, 0)", (connection_id, billing_month, previous_reading, current_reading))
        conn.commit()
        return {'success': True, 'message': 'Reading logged! Bill auto-generated.'}
    except Exception as e:
        conn.rollback()
        return {'success': False, 'message': str(e)}
    finally: cur.close(); conn.close()

def delete_meter_reading(reading_id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT connection_id, billing_month FROM meter_reading WHERE reading_id = %s", (reading_id,))
        row = cur.fetchone()
        if not row: return False, "Reading not found"
        cur.execute("DELETE FROM bill WHERE connection_id = %s AND billing_month = %s", (row[0], row[1]))
        cur.execute("DELETE FROM meter_reading WHERE reading_id = %s", (reading_id,))
        conn.commit()
        return True, "Reading and associated bill successfully deleted."
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally: cur.close(); conn.close()

def update_meter_reading(reading_id, prev_reading, curr_reading):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT connection_id, billing_month FROM meter_reading WHERE reading_id = %s", (reading_id,))
        r = cur.fetchone()
        if not r: raise ValueError("Reading not found")
        cur.execute("DELETE FROM bill WHERE connection_id = %s AND billing_month = %s", (r[0], r[1]))
        cur.execute("DELETE FROM meter_reading WHERE reading_id = %s", (reading_id,))
        cur.execute("INSERT INTO meter_reading (reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed) VALUES (%s, %s, %s, %s, %s, 0)", (reading_id, r[0], r[1], prev_reading, curr_reading))
        conn.commit()
        return True, "Reading updated and new bill generated!"
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally: cur.close(); conn.close()

def update_bill_status_admin(bill_id, status, method=None):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        if status == 'Paid': cur.execute("UPDATE bill SET payment_status = 'Paid', paid_on = NOW(), payment_method = %s WHERE bill_id = %s", (method, bill_id))
        else: cur.execute("UPDATE bill SET payment_status = 'Unpaid', paid_on = NULL, payment_method = NULL WHERE bill_id = %s", (bill_id,))
        conn.commit()
        return True, f"Bill #{bill_id} status updated to {status}."
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally: cur.close(); conn.close()

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

def get_full_invoice_details(bill_id):
    check_and_update_overdue_bills() # Update status just in case it's generated right now
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT b.bill_id, b.billing_month, b.units_consumed, b.amount, b.payment_status, TO_CHAR(b.generated_on, 'YYYY-MM-DD') as generated_on, TO_CHAR(b.due_date, 'YYYY-MM-DD') as due_date, TO_CHAR(b.paid_on, 'YYYY-MM-DD HH24:MI:SS') as paid_on, b.payment_method, COALESCE(c.consumer_id, 0) as consumer_id, COALESCE(c.full_name, 'Deleted Consumer') as consumer_name, COALESCE(c.permanent_address, 'N/A') as permanent_address, COALESCE(conn.connection_id, 0) as connection_id, COALESCE(conn.address, 'Deleted Location') as connection_address, COALESCE(conn.connection_type, 'N/A') as connection_type, COALESCE(conn.load_assign, 'N/A') as load_assign, COALESCE(da.zone, 'N/A') as zone, COALESCE(da.city, 'N/A') as city, COALESCE(pg.grid_name, 'N/A') as grid_name, ts.rate_per_unit, ts.fixed_charge, mr.previous_reading, mr.current_reading
            FROM bill b
            LEFT JOIN consumer c ON b.consumer_id = c.consumer_id
            LEFT JOIN connection conn ON b.connection_id = conn.connection_id
            LEFT JOIN distribution_area da ON conn.area_id = da.area_id
            LEFT JOIN power_grid pg ON da.grid_id = pg.grid_id
            JOIN tariff_slab ts ON b.slab_id = ts.slab_id
            LEFT JOIN meter_reading mr ON b.connection_id = mr.connection_id AND b.billing_month = mr.billing_month
            WHERE b.bill_id = %s
        """, (bill_id,))
        return cur.fetchone()
    finally: cur.close(); conn.close()

def delete_record(table, id_column, record_id): return execute_modify(f"DELETE FROM {table} WHERE {id_column} = %s", (record_id,))

# ==========================================
# DASHBOARD & ANALYTICS
# ==========================================
def get_admin_dashboard_stats(): 
    return execute_query("SELECT (SELECT COUNT(*) FROM power_grid) as total_grids, (SELECT COUNT(*) FROM distribution_area) as total_areas, (SELECT COUNT(*) FROM consumer) as total_consumers, (SELECT COUNT(*) FROM connection) as total_connections, (SELECT COALESCE(SUM(units_supplied), 0) FROM area_monthly_supply) as total_units_supplied", fetchall=False)

def get_analytics_top_areas(): 
    return execute_query("SELECT d.zone, COALESCE(SUM(m.units_consumed), 0)::FLOAT as total_units FROM meter_reading m JOIN connection c ON m.connection_id = c.connection_id JOIN distribution_area d ON c.area_id = d.area_id GROUP BY d.zone ORDER BY total_units DESC LIMIT 5")

def get_analytics_power_loss(): 
    return execute_query("WITH area_supply AS (SELECT area_id, COALESCE(SUM(units_supplied), 0)::FLOAT as total_supplied FROM area_monthly_supply GROUP BY area_id), area_consumed AS (SELECT c.area_id, COALESCE(SUM(m.units_consumed), 0)::FLOAT as total_consumed FROM meter_reading m JOIN connection c ON m.connection_id = c.connection_id GROUP BY c.area_id) SELECT d.zone, d.city, COALESCE(s.total_supplied, 0)::FLOAT as units_supplied, COALESCE(c.total_consumed, 0)::FLOAT as units_consumed, (COALESCE(s.total_supplied, 0) - COALESCE(c.total_consumed, 0))::FLOAT as power_loss FROM distribution_area d LEFT JOIN area_supply s ON d.area_id = s.area_id LEFT JOIN area_consumed c ON d.area_id = c.area_id ORDER BY power_loss DESC")

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

def get_consumer_dashboard(consumer_id):
    check_and_update_overdue_bills() # Ensure overdue bills are accurate
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

def get_consumer_connections(consumer_id): 
    return execute_query("SELECT connection_id, address, connection_type, load_assign as load, TO_CHAR(installation_date, 'YYYY-MM-DD') as install_date, status FROM connection WHERE consumer_id = %s ORDER BY connection_id", (consumer_id,))

def get_consumer_bills(consumer_id): 
    check_and_update_overdue_bills() # Ensure overdue bills show up instantly on Consumer Portal
    return execute_query("SELECT bill_id, connection_id, billing_month as month, units_consumed as units, amount, payment_status as status, TO_CHAR(due_date, 'YYYY-MM-DD') as due_date FROM bill WHERE consumer_id = %s ORDER BY bill_id DESC", (consumer_id,))

def get_consumer_profile(consumer_id): 
    return execute_query("SELECT c.consumer_id, c.full_name, c.permanent_address, c.age, u.username FROM consumer c JOIN consumer_users u ON c.consumer_id = u.consumer_id WHERE c.consumer_id = %s", (consumer_id,), fetchall=False)

def update_consumer_profile(consumer_id, name, address, age, new_password_hash=None):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("UPDATE consumer SET full_name=%s, permanent_address=%s, age=%s WHERE consumer_id=%s", (name, address, age, consumer_id))
        if new_password_hash: cur.execute("UPDATE consumer_users SET password_hash=%s WHERE consumer_id=%s", (new_password_hash, consumer_id))
        conn.commit()
        return True, "Profile updated successfully!"
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally: cur.close(); conn.close()

# ==========================================
# HELP DESK / TICKETING
# ==========================================
def create_ticket(consumer_id, subject, initial_message):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO support_ticket (consumer_id, subject) VALUES (%s, %s) RETURNING ticket_id", (consumer_id, subject))
        ticket_id = cur.fetchone()[0]
        cur.execute("INSERT INTO ticket_reply (ticket_id, sender_role, message) VALUES (%s, 'consumer', %s)", (ticket_id, initial_message))
        conn.commit()
        return True, "Ticket submitted successfully!"
    except Exception as e:
        conn.rollback()
        return False, f"Failed to create ticket: {str(e)}"
    finally: cur.close(); conn.close()

def get_consumer_tickets(consumer_id): return execute_query("SELECT ticket_id, subject, status, is_satisfied, TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at FROM support_ticket WHERE consumer_id = %s ORDER BY ticket_id DESC", (consumer_id,))
def get_all_tickets(): return execute_query("SELECT t.ticket_id, t.subject, t.status, t.is_satisfied, TO_CHAR(t.created_at, 'YYYY-MM-DD HH24:MI') as created_at, COALESCE(c.consumer_id, 0) as consumer_id, COALESCE(c.full_name, 'Deleted User') as consumer_name FROM support_ticket t LEFT JOIN consumer c ON t.consumer_id = c.consumer_id ORDER BY CASE WHEN t.status = 'Open' THEN 1 WHEN t.status = 'In Progress' THEN 2 ELSE 3 END, t.created_at DESC")
def update_ticket_status(ticket_id, status, is_satisfied=None):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        if is_satisfied is not None: cur.execute("UPDATE support_ticket SET status = %s, is_satisfied = %s WHERE ticket_id = %s", (status, is_satisfied, ticket_id))
        else: cur.execute("UPDATE support_ticket SET status = %s WHERE ticket_id = %s", (status, ticket_id))
        conn.commit()
        return True, "Ticket updated."
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally: cur.close(); conn.close()

def get_ticket_thread(ticket_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT t.ticket_id, t.subject, t.status, COALESCE(c.full_name, 'Deleted User') as consumer_name FROM support_ticket t LEFT JOIN consumer c ON t.consumer_id = c.consumer_id WHERE t.ticket_id = %s", (ticket_id,))
        ticket_meta = cur.fetchone()
        if not ticket_meta: return None
        cur.execute("SELECT sender_role, message, TO_CHAR(sent_at, 'Mon DD, HH24:MI') as timestamp FROM ticket_reply WHERE ticket_id = %s ORDER BY sent_at ASC", (ticket_id,))
        return {"ticket": ticket_meta, "replies": cur.fetchall()}
    finally: cur.close(); conn.close()

def add_ticket_reply(ticket_id, sender_role, message):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO ticket_reply (ticket_id, sender_role, message) VALUES (%s, %s, %s)", (ticket_id, sender_role, message))
        if sender_role == 'admin': cur.execute("UPDATE support_ticket SET status = 'In Progress' WHERE ticket_id = %s AND status = 'Open'", (ticket_id,))
        elif sender_role == 'consumer': cur.execute("UPDATE support_ticket SET status = 'Open' WHERE ticket_id = %s AND status != 'Open'", (ticket_id,))
        conn.commit()
        return True, "Reply sent successfully."
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally: cur.close(); conn.close()

def get_latest_official_reading(connection_id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Get the current_reading from the most recent entry
        cur.execute("""
            SELECT current_reading FROM meter_reading 
            WHERE connection_id = %s 
            ORDER BY reading_id DESC LIMIT 1
        """, (connection_id,))
        row = cur.fetchone()
        return row[0] if row else 0
    finally:
        cur.close(); conn.close()

def get_last_reading_row(connection_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cur.execute("""
            SELECT current_reading, billing_month 
            FROM meter_reading 
            WHERE connection_id = %s 
            ORDER BY reading_id DESC LIMIT 1
        """, (connection_id,))
        return cur.fetchone()
    finally:
        cur.close(); conn.close()