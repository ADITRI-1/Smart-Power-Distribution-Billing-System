from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db_connection
import dao
import user_dao 

app = Flask(__name__)
CORS(app)

def init_database():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM admin_users WHERE username = 'gaurav'")
        if cur.fetchone()[0] == 0:
            admin_hash = generate_password_hash('admin')
            cur.execute("INSERT INTO admin_users (full_name, username, password_hash) VALUES (%s, %s, %s)", ('Gaurav Admin', 'gaurav', admin_hash))
        
        cur.execute("SELECT COUNT(*) FROM consumer_users WHERE username = 'gaurav'")
        if cur.fetchone()[0] == 0:
            consumer_hash = generate_password_hash('consumer')
            cur.execute("INSERT INTO consumer_users (consumer_id, username, password_hash) VALUES (%s, %s, %s)", (1002, 'gaurav', consumer_hash))
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Init DB Error: {e}")
    finally:
        cur.close()
        conn.close()

# --- AUTH ROUTES ---
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    hashed_pw = generate_password_hash(data.get('password'))
    success, msg = user_dao.create_consumer_user(data.get('fullname'), data.get('username'), hashed_pw)
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 201 if success else 400

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user_data = user_dao.get_user_login_data(data.get('username'), data.get('loginType'))
    if user_data and check_password_hash(user_data['password_hash'], data.get('password')):
        return jsonify({"message": "Login successful", "role": user_data['role'], "consumer_id": user_data.get('consumer_id')}), 200
    return jsonify({"error": "Invalid username or password"}), 401

# --- ADMIN DASHBOARD ROUTES ---
@app.route('/api/grids', methods=['GET'])
def get_grids(): return jsonify(dao.get_grids())
@app.route('/api/areas', methods=['GET'])
def get_areas(): return jsonify(dao.get_areas())
@app.route('/api/consumers', methods=['GET'])
def get_consumers(): return jsonify(dao.get_consumers())
@app.route('/api/connections', methods=['GET'])
def get_connections(): return jsonify(dao.get_connections())
@app.route('/api/readings', methods=['GET'])
def get_readings(): return jsonify(dao.get_readings())
@app.route('/api/bills', methods=['GET'])
def get_bills(): return jsonify(dao.get_bills())
@app.route('/api/analytics', methods=['GET'])
def get_analytics(): return jsonify({"top_areas": dao.get_analytics_top_areas(), "power_loss": dao.get_analytics_power_loss()})

# NEW: Admin route to view deep consumer details
@app.route('/api/consumer/<int:consumer_id>/details', methods=['GET'])
def get_consumer_details(consumer_id):
    data = dao.get_consumer_full_details(consumer_id)
    return jsonify(data) if data else (jsonify({"error": "Not found"}), 404)

# --- CONSUMER DASHBOARD ROUTES ---
@app.route('/api/consumer/<int:consumer_id>/dashboard', methods=['GET'])
def get_consumer_dash(consumer_id): return jsonify(dao.get_consumer_dashboard(consumer_id))
@app.route('/api/consumer/<int:consumer_id>/connections', methods=['GET'])
def get_consumer_conn(consumer_id): return jsonify(dao.get_consumer_connections(consumer_id))
@app.route('/api/consumer/<int:consumer_id>/bills', methods=['GET'])
def get_consumer_bills(consumer_id): return jsonify(dao.get_consumer_bills(consumer_id))

# --- ADD & DELETE ROUTES ---
@app.route('/api/delete/<table_name>/<int:record_id>', methods=['DELETE'])
def delete_record(table_name, record_id):
    pk_map = {'power_grid': 'grid_id', 'distribution_area': 'area_id', 'consumer': 'consumer_id', 'connection': 'connection_id'}
    success, msg = dao.delete_record(table_name, pk_map.get(table_name), record_id)
    return jsonify({"message": "Deleted"}), 200 if success else 500

@app.route('/api/grids', methods=['POST'])
def add_grid():
    data = request.json
    success, msg = dao.add_grid(data['id'], data['name'], data['location'])
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 201 if success else 400

@app.route('/api/consumers', methods=['POST'])
def add_consumer():
    data = request.json
    success, msg = dao.add_consumer(data['id'], data['name'], data['address'], data['age'])
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 201 if success else 400
# For triggers Application
@app.route('/api/readings', methods=['POST'])
def add_reading():
    data = request.json
    result = dao.generate_bill_for_reading(
        reading_id=data['reading_id'],
        connection_id=data['connection_id'],
        billing_month=data['billing_month'],
        previous_reading=data['previous_reading'],
        current_reading=data['current_reading'],
        bill_id=data['bill_id']
    )
    return jsonify(result), 201 if result['success'] else 400

@app.route('/api/consumer/<int:consumer_id>/analysis', methods=['GET'])
def get_bill_analysis(consumer_id):
    result = dao.get_consumer_bill_analysis(consumer_id)
    return jsonify(result), 200 if result['success'] else 404
    
# ──  Pay a bill (transaction demo) ───
@app.route('/api/bills/<int:bill_id>/pay', methods=['POST'])
def pay_bill(bill_id):
    result = dao.pay_bill_transaction(bill_id)
    return jsonify(result), 200 if result['success'] else 400

# ── Transfer connection area (savepoint demo) ──
@app.route('/api/connections/<int:connection_id>/transfer', methods=['POST'])
def transfer_connection(connection_id):
    data = request.json
    result = dao.transfer_connection_area(
        connection_id,
        data.get('new_area_id'),
        data.get('new_load')
    )
    return jsonify(result), 200 if result['success'] else 400

if __name__ == '__main__':
    init_database()
    app.run(debug=True, port=5000)