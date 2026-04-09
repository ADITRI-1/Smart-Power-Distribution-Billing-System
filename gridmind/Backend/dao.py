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
def get_connections(): 
    # Ensure no caching: fetch fresh status every time [cite: 8]
    return execute_query("""
        SELECT connection_id, consumer_id, area_id, connection_type, 
               load_assign as load, TO_CHAR(installation_date, 'YYYY-MM-DD') as install_date, 
               status 
        FROM connection 
        ORDER BY connection_id
    """)
def get_readings(): return execute_query("SELECT reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed FROM meter_reading ORDER BY reading_id DESC")
def get_bills(): return execute_query("SELECT bill_id, consumer_id, connection_id, billing_month as month, units_consumed as units, amount, payment_status as status, TO_CHAR(due_date, 'YYYY-MM-DD') as due_date FROM bill ORDER BY due_date DESC, bill_id DESC")

def add_grid(grid_id, grid_name, location): return execute_modify("INSERT INTO power_grid (grid_id, grid_name, location) VALUES (%s, %s, %s)", (grid_id, grid_name, location))
def add_area(area_id, grid_id, zone, city, poc): return execute_modify("INSERT INTO distribution_area (area_id, grid_id, zone, city, poc) VALUES (%s, %s, %s, %s, %s)", (area_id, grid_id, zone, city, poc))
def add_consumer(consumer_id, name, address, age, username, password_hash, email): # <-- Added email here
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO consumer (consumer_id, full_name, permanent_address, age) 
            VALUES (%s, %s, %s, %s)
        """, (consumer_id, name, address, age))
        
        # Insert the email into the auth table
        cur.execute("""
            INSERT INTO consumer_users (consumer_id, username, password_hash, email) 
            VALUES (%s, %s, %s, %s)
        """, (consumer_id, username, password_hash, email)) # <-- Added email here
        
        conn.commit()
        return True, "Consumer and Login Profile created successfully!"
    except Exception as e:
        conn.rollback() 
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
        # 1. Prevent Future Months
        current_month = datetime.now().strftime('%Y-%m')
        if billing_month > current_month:
            raise ValueError(f"Cannot log readings for future months. (Current max: {current_month})")

        cur.execute("SELECT status FROM connection WHERE connection_id = %s", (connection_id,))
        c = cur.fetchone()
        if not c or c[0] != 'Active': raise ValueError("Connection inactive/invalid.")
        
        # 2. Silently wipe out the Base placeholder reading
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
        # Find the connection and month so we can delete the attached bill
        cur.execute("SELECT connection_id, billing_month FROM meter_reading WHERE reading_id = %s", (reading_id,))
        row = cur.fetchone()
        if not row: return False, "Reading not found"
        
        # Delete the Bill FIRST, then delete the Reading
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
        # To trigger the automatic bill generation again, we safely delete and re-insert the reading!
        cur.execute("SELECT connection_id, billing_month FROM meter_reading WHERE reading_id = %s", (reading_id,))
        r = cur.fetchone()
        if not r: raise ValueError("Reading not found")
        
        # Delete old bill & old reading
        cur.execute("DELETE FROM bill WHERE connection_id = %s AND billing_month = %s", (r[0], r[1]))
        cur.execute("DELETE FROM meter_reading WHERE reading_id = %s", (reading_id,))
        
        # Re-insert reading with same ID (This forces the DB Trigger to generate a brand new bill!)
        cur.execute("INSERT INTO meter_reading (reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed) VALUES (%s, %s, %s, %s, %s, 0)", (reading_id, r[0], r[1], prev_reading, curr_reading))
        
        conn.commit()
        return True, "Reading updated and new bill generated!"
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally: cur.close(); conn.close()
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

def log_login_attempt(username, login_type, status):
    """Records every login attempt in the database."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO login_logs (username, login_type, status) VALUES (%s, %s, %s)",
            (username, login_type, status)
        )
        conn.commit()
    except Exception as e: pass
    finally: cur.close(); conn.close()

def check_and_get_user(username, login_type):
    """Fetches user data and checks if they are currently locked out."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        table = "admin_users" if login_type == "admin" else "consumer_users"
        
        cur.execute(f"SELECT password_hash, failed_attempts, locked_until, {'consumer_id' if login_type == 'consumer' else 'admin_id'} FROM {table} WHERE username = %s", (username,))
        user = cur.fetchone()
        
        if not user: return None
        
        # --- NEW DYNAMIC TIME CALCULATION ---
        if user['locked_until']:
            # Ask Postgres to calculate the exact difference in seconds
            cur.execute("SELECT EXTRACT(EPOCH FROM (%s - NOW())) AS seconds_left", (user['locked_until'],))
            seconds_left = cur.fetchone()['seconds_left']
            
            if seconds_left and seconds_left > 0:
                minutes = int(seconds_left // 60)
                seconds = int(seconds_left % 60)
                # Pass the exact formatted time back to app.py
                return {"is_locked": True, "time_left": f"{minutes}m {seconds}s"}
            else:
                # Time expired, unlock them
                cur.execute(f"UPDATE {table} SET failed_attempts = 0, locked_until = NULL WHERE username = %s", (username,))
                conn.commit()
                user['failed_attempts'] = 0

        user['is_locked'] = False
        user['role'] = login_type
        return user
    finally: cur.close(); conn.close()

def handle_failed_login(username, login_type):
    """Increments failed attempts. Locks for 30 mins if hits 5."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        table = "admin_users" if login_type == "admin" else "consumer_users"
        
        # Increment failed attempts
        cur.execute(f"UPDATE {table} SET failed_attempts = failed_attempts + 1 WHERE username = %s RETURNING failed_attempts", (username,))
        attempts = cur.fetchone()
        
        if attempts and attempts[0] >= 5:
            # Lock the account for 30 minutes
            cur.execute(f"UPDATE {table} SET locked_until = NOW() + INTERVAL '30 minutes' WHERE username = %s", (username,))
            conn.commit()
            return True # Indicates they just got locked
        
        conn.commit()
        return False # Not locked yet
    finally: cur.close(); conn.close()

def handle_successful_login(username, login_type):
    """Resets attempts on success."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        table = "admin_users" if login_type == "admin" else "consumer_users"
        cur.execute(f"UPDATE {table} SET failed_attempts = 0, locked_until = NULL WHERE username = %s", (username,))
        conn.commit()
    finally: cur.close(); conn.close()

def generate_reset_token(email, login_type):
    """Generates a 6-digit OTP, saves it to the DB with a 15 min expiry."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        table = "admin_users" if login_type == "admin" else "consumer_users"
        
        # Check if email exists
        cur.execute(f"SELECT username FROM {table} WHERE email = %s", (email,))
        if not cur.fetchone():
            return None # Email not found
        
        # Generate 6-digit OTP
        otp = ''.join(random.choices(string.digits, k=6))
        
        # Update DB with token and expiry
        cur.execute(f"UPDATE {table} SET reset_token = %s, token_expiry = NOW() + INTERVAL '15 minutes' WHERE email = %s", (otp, email))
        conn.commit()
        return otp
    except Exception as e:
        conn.rollback()
        return None
    finally: cur.close(); conn.close()

def reset_password_with_token(email, token, new_password_hash, login_type):
    """Verifies the OTP and updates the password if valid."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        table = "admin_users" if login_type == "admin" else "consumer_users"
        
        # Check token and expiry
        cur.execute(f"SELECT reset_token FROM {table} WHERE email = %s AND reset_token = %s AND token_expiry > NOW()", (email, token))
        if not cur.fetchone():
            return False, "Invalid or expired OTP."
        
        # Reset password and clear token safely
        cur.execute(f"UPDATE {table} SET password_hash = %s, reset_token = NULL, token_expiry = NULL, failed_attempts = 0, locked_until = NULL WHERE email = %s", (new_password_hash, email))
        conn.commit()
        return True, "Password reset successfully."
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally: cur.close(); conn.close()

def update_bill_status_admin(bill_id, status, method=None):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        if status == 'Paid':
            # Mark as paid, set the date, and save the payment method (Cash, UPI, etc.)
            cur.execute("""
                UPDATE bill 
                SET payment_status = 'Paid', paid_on = NOW(), payment_method = %s 
                WHERE bill_id = %s
            """, (method, bill_id))
        else:
            # Revert to unpaid. Clear the paid_on date and the payment method!
            cur.execute("""
                UPDATE bill 
                SET payment_status = 'Unpaid', paid_on = NULL, payment_method = NULL 
                WHERE bill_id = %s
            """, (bill_id,))
            
        conn.commit()
        return True, f"Bill #{bill_id} status updated to {status}."
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally:
        cur.close()
        conn.close()

def get_full_invoice_details(bill_id):
    """Fetches a massive, joined payload of every single detail related to a bill."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT 
                b.bill_id, b.billing_month, b.units_consumed, b.amount, b.payment_status, 
                TO_CHAR(b.generated_on, 'YYYY-MM-DD') as generated_on, 
                TO_CHAR(b.due_date, 'YYYY-MM-DD') as due_date, 
                TO_CHAR(b.paid_on, 'YYYY-MM-DD HH24:MI:SS') as paid_on,
                b.payment_method,
                c.consumer_id, c.full_name as consumer_name, c.permanent_address,
                conn.connection_id, conn.address as connection_address, conn.connection_type, conn.load_assign,
                da.zone, da.city,
                pg.grid_name,
                ts.rate_per_unit, ts.fixed_charge,
                mr.previous_reading, mr.current_reading
            FROM bill b
            JOIN consumer c ON b.consumer_id = c.consumer_id
            JOIN connection conn ON b.connection_id = conn.connection_id
            JOIN distribution_area da ON conn.area_id = da.area_id
            JOIN power_grid pg ON da.grid_id = pg.grid_id
            JOIN tariff_slab ts ON b.slab_id = ts.slab_id
            LEFT JOIN meter_reading mr ON b.connection_id = mr.connection_id AND b.billing_month = mr.billing_month
            WHERE b.bill_id = %s
        """, (bill_id,))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()