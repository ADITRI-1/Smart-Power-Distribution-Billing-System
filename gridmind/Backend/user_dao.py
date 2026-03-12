import psycopg2
from psycopg2.extras import RealDictCursor
from database import get_db_connection

def create_consumer_user(full_name, username, hashed_password):
    """Creates a new electricity consumer and links an auth account to them."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # 1. Generate a new consumer_id (Get max + 1)
        cur.execute("SELECT MAX(consumer_id) FROM consumer")
        max_id = cur.fetchone()[0]
        new_consumer_id = (max_id + 1) if max_id else 1000

        # 2. Insert into the main consumer table
        cur.execute(
            "INSERT INTO consumer (consumer_id, full_name, permanent_address, age) VALUES (%s, %s, %s, %s)",
            (new_consumer_id, full_name, 'Pending Address', 18)
        )

        # 3. Insert into the consumer_users auth table
        cur.execute(
            "INSERT INTO consumer_users (consumer_id, username, password_hash) VALUES (%s, %s, %s)",
            (new_consumer_id, username, hashed_password)
        )
        conn.commit()
        return True, "Consumer account created successfully"
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        return False, "Username already exists"
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally:
        cur.close()
        conn.close()

def get_user_login_data(username, login_type):
    """Retrieves the hashed password from the correct table based on portal type."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if login_type == 'admin':
            cur.execute("SELECT password_hash FROM admin_users WHERE username = %s", (username,))
            result = cur.fetchone()
            if result:
                result['role'] = 'admin'
                return result
                
        elif login_type == 'consumer':
            cur.execute("SELECT password_hash, consumer_id FROM consumer_users WHERE username = %s", (username,))
            result = cur.fetchone()
            if result:
                result['role'] = 'consumer'
                return result
        return None
    except Exception as e:
        print(f"Database error: {e}")
        return None
    finally:
        cur.close()
        conn.close()