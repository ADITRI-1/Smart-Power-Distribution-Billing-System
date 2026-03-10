import psycopg2
from database import get_db_connection

def create_user(full_name, username, hashed_password):
    """Inserts a new user into the database."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users (full_name, username, password_hash) VALUES (%s, %s, %s)",
            (full_name, username, hashed_password)
        )
        conn.commit()
        return True, "User created successfully"
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        return False, "Username already exists"
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally:
        cur.close()
        conn.close()

def get_user_password_hash(username):
    """Retrieves the hashed password for a specific user."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT password_hash FROM users WHERE username = %s", (username,))
        result = cur.fetchone()
        if result:
            return result[0] # Return just the hash
        return None
    except Exception as e:
        print(f"Database error: {e}")
        return None
    finally:
        cur.close()
        conn.close()