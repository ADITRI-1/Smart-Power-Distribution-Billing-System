from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db_connection
import dao

app = Flask(__name__)
CORS(app)

def init_database():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM admin_users")
        if cur.fetchone()[0] == 0:
            admin_hash = generate_password_hash('admin123')
            cur.execute("INSERT INTO admin_users (full_name, username, password_hash) VALUES (%s, %s, %s)", ('System Admin', 'admin', admin_hash))
            cur.execute("INSERT INTO admin_users (full_name, username, password_hash) VALUES (%s, %s, %s)", ('Gaurav Admin', 'gaurav_admin', admin_hash))
        
        cur.execute("SELECT COUNT(*) FROM consumer_users")
        if cur.fetchone()[0] == 0:
            user_hash = generate_password_hash('user123')
            cur.execute("INSERT INTO consumer_users (consumer_id, username, password_hash) VALUES (%s, %s, %s)", (1001, 'aditri', user_hash))
            cur.execute("INSERT INTO consumer_users (consumer_id, username, password_hash) VALUES (%s, %s, %s)", (1002, 'gaurav', user_hash))
            cur.execute("INSERT INTO consumer_users (consumer_id, username, password_hash) VALUES (%s, %s, %s)", (1003, 'kushagra', user_hash))
        conn.commit()
    except Exception as e:
        conn.rollback()
    finally:
        cur.close()
        conn.close()

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    hashed_pw = generate_password_hash(data.get('password'))
    success, msg = dao.create_consumer_user(data.get('fullname'), data.get('username'), hashed_pw)
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 201 if success else 400

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user_data = dao.get_user_login_data(data.get('username'), data.get('loginType'))
    if user_data and check_password_hash(user_data['password_hash'], data.get('password')):
        return jsonify({"message": "Login successful", "role": user_data['role'], "consumer_id": user_data.get('consumer_id')}), 200
    return jsonify({"error": "Invalid username or password"}), 401

@app.route('/api/admin/dashboard', methods=['GET'])
def admin_dashboard_stats(): return jsonify(dao.get_admin_dashboard_stats())

@app.route('/api/grids', methods=['GET', 'POST'])
def grids():
    if request.method == 'POST':
        data = request.json
        success, msg = dao.add_grid(data['id'], data['name'], data['location'])
        return jsonify({"message": msg}) if success else jsonify({"error": msg}), 201 if success else 400
    return jsonify(dao.get_grids())

@app.route('/api/grids/<int:grid_id>', methods=['PUT'])
def edit_grid(grid_id):
    data = request.json
    success, msg = dao.update_grid(grid_id, data['name'], data['location'])
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

@app.route('/api/areas', methods=['GET', 'POST'])
def areas():
    if request.method == 'POST':
        data = request.json
        success, msg = dao.add_area(data['id'], data['grid_id'], data['zone'], data['city'], data['poc'])
        return jsonify({"message": msg}) if success else jsonify({"error": msg}), 201 if success else 400
    return jsonify(dao.get_areas())

@app.route('/api/areas/<int:area_id>', methods=['PUT'])
def edit_area(area_id):
    data = request.json
    success, msg = dao.update_area(area_id, data['zone'], data['city'], data['grid_id'], data['poc'])
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

# ========================================================
# FIXED: Added 'GET' to methods to allow fetching consumers
# ========================================================
@app.route('/api/consumers', methods=['GET', 'POST'])
def consumers():
    if request.method == 'POST':
        data = request.json
        pw_hash = generate_password_hash(data['password'])
        success, msg = dao.add_consumer(
            data['id'], data['name'], data['address'], data['age'], data['username'], pw_hash
        )
        if success:
            return jsonify({"message": msg}), 201
        else:
            return jsonify({"error": msg}), 400
            
    # This line sends the data back when the page loads!
    return jsonify(dao.get_consumers())

@app.route('/api/consumers/<int:consumer_id>', methods=['PUT'])
def edit_consumer(consumer_id):
    data = request.json
    success, msg = dao.update_consumer(consumer_id, data['name'], data['address'], data['age'])
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

@app.route('/api/connections', methods=['GET', 'POST'])
def connections():
    if request.method == 'POST':
        data = request.json
        success, msg = dao.add_connection(data['id'], data['consumer_id'], data['area_id'], data['address'], data['type'], data['load'], data['install_date'], data['status'])
        return jsonify({"message": msg}) if success else jsonify({"error": msg}), 201 if success else 400
    return jsonify(dao.get_connections())

@app.route('/api/connections/<int:connection_id>', methods=['PUT'])
def edit_connection(connection_id):
    data = request.json
    success, msg = dao.update_connection(connection_id, data['consumer_id'], data['area_id'], data['type'], data['load'], data['status'])
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

@app.route('/api/readings', methods=['GET', 'POST'])
def readings():
    if request.method == 'POST':
        data = request.json
        result = dao.add_meter_reading(data['connection_id'], data['billing_month'], data['previous_reading'], data['current_reading'])
        return jsonify(result), 201 if result['success'] else 400
    return jsonify(dao.get_readings())

@app.route('/api/bills', methods=['GET'])
def get_bills(): return jsonify(dao.get_bills())

@app.route('/api/analytics', methods=['GET'])
def get_analytics(): return jsonify({"top_areas": dao.get_analytics_top_areas(), "power_loss": dao.get_analytics_power_loss()})

@app.route('/api/consumer/<int:consumer_id>/details', methods=['GET'])
def get_consumer_details(consumer_id):
    data = dao.get_consumer_full_details(consumer_id)
    return jsonify(data) if data else (jsonify({"error": "Not found"}), 404)

@app.route('/api/consumer/<int:consumer_id>/dashboard', methods=['GET'])
def get_consumer_dash(consumer_id): return jsonify(dao.get_consumer_dashboard(consumer_id))

@app.route('/api/consumer/<int:consumer_id>/connections', methods=['GET'])
def get_consumer_conn(consumer_id): return jsonify(dao.get_consumer_connections(consumer_id))

@app.route('/api/consumer/<int:consumer_id>/bills', methods=['GET'])
def get_consumer_bills(consumer_id): return jsonify(dao.get_consumer_bills(consumer_id))

@app.route('/api/delete/<table_name>/<int:record_id>', methods=['DELETE'])
def delete_record(table_name, record_id):
    pk_map = {'power_grid': 'grid_id', 'distribution_area': 'area_id', 'consumer': 'consumer_id', 'connection': 'connection_id'}
    success, msg = dao.delete_record(table_name, pk_map.get(table_name), record_id)
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

@app.route('/api/bills/<int:bill_id>/pay', methods=['POST'])
def pay_bill(bill_id):
    result = dao.pay_bill_transaction(bill_id)
    return jsonify(result), 200 if result['success'] else 400

@app.route('/api/consumer/<int:consumer_id>/profile', methods=['GET', 'PUT'])
def consumer_profile(consumer_id):
    if request.method == 'PUT':
        data = request.json
        pw_hash = generate_password_hash(data['password']) if data.get('password') else None
        success, msg = dao.update_consumer_profile(consumer_id, data['name'], data['address'], data['age'], pw_hash)
        return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400
    return jsonify(dao.get_consumer_profile(consumer_id))

if __name__ == '__main__':
    init_database()
    app.run(debug=True, port=5000)