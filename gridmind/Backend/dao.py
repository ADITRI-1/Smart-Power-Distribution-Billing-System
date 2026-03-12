# ==========================================
# --- CONSUMER PORTAL QUERIES ---
# ==========================================
def get_consumer_dashboard(consumer_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Get total connections owned by this consumer
        cur.execute("SELECT COUNT(*) as total_conns FROM connection WHERE consumer_id = %s", (consumer_id,))
        conns = cur.fetchone()['total_conns']
        
        # Get unpaid bills count and total amount due
        cur.execute("""
            SELECT COUNT(*) as unpaid_bills, COALESCE(SUM(amount), 0) as total_due 
            FROM bill WHERE consumer_id = %s AND payment_status != 'Paid'
        """, (consumer_id,))
        bills_info = cur.fetchone()
        
        return {
            "total_connections": conns,
            "unpaid_bills": bills_info['unpaid_bills'],
            "total_due": bills_info['total_due']
        }
    except Exception as e:
        print(e)
        return {"total_connections": 0, "unpaid_bills": 0, "total_due": 0}
    finally:
        cur.close()
        conn.close()

def get_consumer_connections(consumer_id):
    return execute_query("""
        SELECT connection_id, address, connection_type, load_assign as load, 
               TO_CHAR(installation_date, 'YYYY-MM-DD') as install_date, status
        FROM connection WHERE consumer_id = %s ORDER BY connection_id
    """, (consumer_id,))

def get_consumer_bills(consumer_id):
    return execute_query("""
        SELECT bill_id, connection_id, billing_month as month, units_consumed as units, 
               amount, payment_status as status, TO_CHAR(due_date, 'YYYY-MM-DD') as due_date 
        FROM bill WHERE consumer_id = %s ORDER BY bill_id DESC
    """, (consumer_id,))