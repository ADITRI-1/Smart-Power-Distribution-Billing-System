from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db_connection
import dao
from datetime import datetime

app = Flask(__name__)
CORS(app)

def init_database():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM admin_users")
        if cur.fetchone()[0] == 0:
            admin_hash = generate_password_hash('admin123')
            cur.execute("INSERT INTO admin_users (full_name, username, password_hash, email) VALUES (%s, %s, %s, %s)", ('System Admin', 'admin', admin_hash, 'admin@smartpower.com'))
            cur.execute("INSERT INTO admin_users (full_name, username, password_hash) VALUES (%s, %s, %s)", ('Gaurav Admin', 'gaurav_admin', admin_hash))
        conn.commit()
    except Exception as e:
        conn.rollback()
        print("DB Init Error (Ignored if tables already populated):", e)
    finally:
        cur.close()
        conn.close()

# ========================================================
# AUTHENTICATION (Infinite Attempts Allowed)
# ========================================================
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    login_type = data.get('loginType')
    password = data.get('password')

    user_data = dao.check_and_get_user(username, login_type)
    
    if not user_data or not check_password_hash(user_data['password_hash'], password):
        return jsonify({"error": "Invalid username or password"}), 401

    return jsonify({
        "message": "Login successful", 
        "role": user_data['role'], 
        "consumer_id": user_data.get('consumer_id'),
        "username": username
    }), 200

@app.route('/api/admin/change-password', methods=['POST'])
def admin_change_password():
    data = request.json
    username = data.get('username')
    old_pw = data.get('oldPassword')
    new_pw = data.get('newPassword')
    
    user_data = dao.check_and_get_user(username, 'admin')
    if not user_data or not check_password_hash(user_data['password_hash'], old_pw):
        return jsonify({"error": "Incorrect current password"}), 401
        
    hashed_pw = generate_password_hash(new_pw)
    success, msg = dao.update_admin_password(username, hashed_pw)
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    data = request.json
    email = data.get('email')
    login_type = data.get('loginType', 'consumer')
    otp = dao.generate_reset_token(email, login_type)
    if otp:
        print(f"\n📩 SIMULATED EMAIL DISPATCH\nTo: {email}\nSubject: Password Reset\nOTP: {otp}\n")
    return jsonify({"message": "If the email exists, an OTP has been sent."}), 200

@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    hashed_pw = generate_password_hash(data.get('newPassword'))
    success, msg = dao.reset_password_with_token(data.get('email'), data.get('token'), hashed_pw, data.get('loginType', 'consumer'))
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

# ========================================================
# CORE ENTITIES
# ========================================================
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

@app.route('/api/consumers', methods=['GET', 'POST'])
def consumers():
    if request.method == 'POST':
        data = request.json
        pw_hash = generate_password_hash(data['password'])
        success, msg = dao.add_consumer(data['id'], data['name'], data['address'], data['age'], data['username'], pw_hash, data.get('email'))
        return jsonify({"message": msg}), 201 if success else 400
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

# ========================================================
# BILLING & READINGS
# ========================================================
@app.route('/api/readings', methods=['GET', 'POST'])
def readings():
    if request.method == 'POST':
        data = request.json
        result = dao.add_meter_reading(data['connection_id'], data['billing_month'], data['previous_reading'], data['current_reading'])
        return jsonify(result), 201 if result['success'] else 400
    return jsonify(dao.get_readings())

@app.route('/api/readings/<int:reading_id>', methods=['PUT', 'DELETE'])
def modify_reading(reading_id):
    if request.method == 'DELETE':
        success, msg = dao.delete_meter_reading(reading_id)
        return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400
    elif request.method == 'PUT':
        data = request.json
        success, msg = dao.update_meter_reading(reading_id, data['previous_reading'], data['current_reading'])
        return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

@app.route('/api/bills', methods=['GET'])
def get_bills(): return jsonify(dao.get_bills())

@app.route('/api/admin/bills/<int:bill_id>/status', methods=['PUT'])
def admin_update_bill_status(bill_id):
    data = request.json
    success, msg = dao.update_bill_status_admin(bill_id, data.get('status'), data.get('method'))
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

@app.route('/api/bills/<int:bill_id>/invoice', methods=['GET'])
def get_invoice(bill_id):
    data = dao.get_full_invoice_details(bill_id)
    return jsonify(data), 200 if data else 404

@app.route('/api/bills/<int:bill_id>/pay', methods=['POST'])
def pay_bill(bill_id):
    result = dao.pay_bill_transaction(bill_id)
    return jsonify(result), 200 if result['success'] else 400

# ========================================================
# ANALYTICS & CONSUMER PORTAL & TICKETS
# ========================================================
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

@app.route('/api/consumer/<int:consumer_id>/profile', methods=['GET', 'PUT'])
def consumer_profile(consumer_id):
    if request.method == 'PUT':
        data = request.json
        pw_hash = generate_password_hash(data['password']) if data.get('password') else None
        success, msg = dao.update_consumer_profile(consumer_id, data['name'], data['address'], data['age'], pw_hash)
        return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400
    return jsonify(dao.get_consumer_profile(consumer_id))

@app.route('/api/consumer/<int:consumer_id>/tickets', methods=['GET', 'POST'])
def handle_consumer_tickets(consumer_id):
    if request.method == 'POST':
        data = request.json
        success, msg = dao.create_ticket(consumer_id, data.get('subject'), data.get('message'))
        return jsonify({"message": msg}) if success else jsonify({"error": msg}), 201 if success else 400
    return jsonify(dao.get_consumer_tickets(consumer_id)), 200

@app.route('/api/admin/tickets', methods=['GET'])
def admin_get_all_tickets(): return jsonify(dao.get_all_tickets()), 200

@app.route('/api/admin/tickets/<int:ticket_id>/status', methods=['PUT'])
def admin_update_ticket_status(ticket_id):
    data = request.json
    success, msg = dao.update_ticket_status(ticket_id, data.get('status'), data.get('is_satisfied'))
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

@app.route('/api/tickets/<int:ticket_id>/replies', methods=['GET'])
def get_ticket_conversation(ticket_id):
    thread_data = dao.get_ticket_thread(ticket_id)
    return jsonify(thread_data), 200 if thread_data else 404

@app.route('/api/tickets/<int:ticket_id>/reply', methods=['POST'])
def post_ticket_reply(ticket_id):
    data = request.json
    success, msg = dao.add_ticket_reply(ticket_id, data.get('senderRole'), data.get('message'))
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 201 if success else 400

@app.route('/api/delete/<table_name>/<int:record_id>', methods=['DELETE'])
def delete_record(table_name, record_id):
    pk_map = {'power_grid': 'grid_id', 'distribution_area': 'area_id', 'consumer': 'consumer_id', 'connection': 'connection_id'}
    success, msg = dao.delete_record(table_name, pk_map.get(table_name), record_id)
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

if __name__ == '__main__':
    init_database()
    app.run(debug=True, port=5000)