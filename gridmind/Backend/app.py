from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db_connection
import dao
import re

app = Flask(__name__)
CORS(app)

def is_strong_password(password):
    """Backend validation: Min 8 chars, 1 uppercase, 1 number, 1 symbol"""
    if len(password) < 8: return False
    if not re.search(r"[A-Z]", password): return False
    if not re.search(r"\d", password): return False
    if not re.search(r"[\W_]", password): return False
    return True

def init_database():
    """Cleans up your existing DB and enforces the new default passwords."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # 1. Delete Gaurav Admin
        cur.execute("DELETE FROM admin_users WHERE username = 'gaurav_admin'")
        
        # 2. Update existing 'admin' to Admin@123
        admin_hash = generate_password_hash('Admin@123')
        cur.execute("UPDATE admin_users SET password_hash = %s WHERE username = 'admin'", (admin_hash,))
        
        # 3. Update all existing consumers to User@123
        user_hash = generate_password_hash('User@123')
        cur.execute("UPDATE consumer_users SET password_hash = %s", (user_hash,))
        
        conn.commit()
        print("Database cleanup complete! Passwords updated.")
    except Exception as e:
        conn.rollback()
        print("DB Init Error:", e)
    finally:
        cur.close()
        conn.close()

# ========================================================
# AUTHENTICATION
# ========================================================
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    login_type = data.get('loginType')
    password = data.get('password')
    consumer_id_input = data.get('consumerId') # Capture the new input
    
    user_data = dao.check_and_get_user(username, login_type)
    
    # 1. Check Username and Password
    if not user_data or not check_password_hash(user_data['password_hash'], password):
        return jsonify({"error": "Invalid username or password"}), 401

    # 2. STRICT CHECK: Ensure the Consumer ID matches the Username!
    if login_type == 'consumer':
        if str(user_data.get('consumer_id')) != str(consumer_id_input):
            return jsonify({"error": "Consumer ID does not match this username!"}), 401

    return jsonify({
        "message": "Login successful", 
        "role": user_data['role'], 
        "consumer_id": user_data.get('consumer_id'),
        "username": username
    }), 200

@app.route('/api/admin/change-password', methods=['POST'])
def admin_change_password():
    data = request.json
    new_pw = data.get('newPassword')
    
    # STRICT ENFORCEMENT
    if not is_strong_password(new_pw):
        return jsonify({"error": "Password must have 8+ chars, 1 uppercase, 1 number, 1 symbol."}), 400

    user_data = dao.check_and_get_user(data.get('username'), 'admin')
    if not user_data or not check_password_hash(user_data['password_hash'], data.get('oldPassword')):
        return jsonify({"error": "Incorrect current password"}), 401
        
    success, msg = dao.update_admin_password(data.get('username'), generate_password_hash(new_pw))
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    new_pw = data.get('newPassword')
    
    # STRICT ENFORCEMENT
    if not is_strong_password(new_pw):
        return jsonify({"error": "Password must have 8+ chars, 1 uppercase, 1 number, 1 symbol."}), 400

    success, msg = dao.reset_password_with_token(data.get('email'), data.get('token'), generate_password_hash(new_pw), data.get('loginType', 'consumer'))
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    otp = dao.generate_reset_token(request.json.get('email'), request.json.get('loginType', 'consumer'))
    if otp: print(f"\n📩 SIMULATED EMAIL DISPATCH\nTo: {request.json.get('email')}\nOTP: {otp}\n")
    return jsonify({"message": "If the email exists, an OTP has been sent."}), 200

# ========================================================
# CORE ENTITIES
# ========================================================
@app.route('/api/consumers', methods=['GET', 'POST'])
def consumers():
    if request.method == 'POST':
        data = request.json
        # STRICT ENFORCEMENT ON NEW CONSUMER CREATION
        if not is_strong_password(data['password']):
            return jsonify({"error": "Password must have 8+ chars, 1 uppercase, 1 number, 1 symbol."}), 400
            
        pw_hash = generate_password_hash(data['password'])
        success, msg = dao.add_consumer(data['id'], data['name'], data['address'], data['age'], data['username'], pw_hash, data.get('email'))
        return jsonify({"message": msg}), 201 if success else 400
    return jsonify(dao.get_consumers())

@app.route('/api/consumer/<int:consumer_id>/profile', methods=['GET', 'PUT'])
def consumer_profile(consumer_id):
    if request.method == 'PUT':
        data = request.json
        pw_hash = None
        if data.get('password'):
            # STRICT ENFORCEMENT ON PROFILE UPDATE
            if not is_strong_password(data['password']):
                return jsonify({"error": "Password must have 8+ chars, 1 uppercase, 1 number, 1 symbol."}), 400
            pw_hash = generate_password_hash(data['password'])
            
        success, msg = dao.update_consumer_profile(consumer_id, data['name'], data['address'], data['age'], pw_hash)
        return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400
    return jsonify(dao.get_consumer_profile(consumer_id))

# --- KEEP ALL YOUR OTHER EXISTING ROUTES EXACTLY AS THEY ARE (Grids, Areas, Connections, Bills, Readings, Analytics, etc) ---
@app.route('/api/admin/dashboard', methods=['GET'])
def admin_dashboard_stats(): return jsonify(dao.get_admin_dashboard_stats())

@app.route('/api/grids', methods=['GET', 'POST'])
def grids():
    if request.method == 'POST':
        success, msg = dao.add_grid(request.json['id'], request.json['name'], request.json['location'])
        return jsonify({"message": msg}) if success else jsonify({"error": msg}), 201 if success else 400
    return jsonify(dao.get_grids())

@app.route('/api/grids/<int:grid_id>', methods=['PUT'])
def edit_grid(grid_id):
    success, msg = dao.update_grid(grid_id, request.json['name'], request.json['location'])
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

@app.route('/api/areas', methods=['GET', 'POST'])
def areas():
    if request.method == 'POST':
        success, msg = dao.add_area(request.json['id'], request.json['grid_id'], request.json['zone'], request.json['city'], request.json['poc'])
        return jsonify({"message": msg}) if success else jsonify({"error": msg}), 201 if success else 400
    return jsonify(dao.get_areas())

@app.route('/api/areas/<int:area_id>', methods=['PUT'])
def edit_area(area_id):
    success, msg = dao.update_area(area_id, request.json['zone'], request.json['city'], request.json['grid_id'], request.json['poc'])
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

@app.route('/api/consumers/<int:consumer_id>', methods=['PUT'])
def edit_consumer(consumer_id):
    success, msg = dao.update_consumer(consumer_id, request.json['name'], request.json['address'], request.json['age'])
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

@app.route('/api/connections', methods=['GET', 'POST'])
def connections():
    if request.method == 'POST':
        success, msg = dao.add_connection(request.json['id'], request.json['consumer_id'], request.json['area_id'], request.json['address'], request.json['type'], request.json['load'], request.json['install_date'], request.json['status'])
        return jsonify({"message": msg}) if success else jsonify({"error": msg}), 201 if success else 400
    return jsonify(dao.get_connections())

@app.route('/api/connections/<int:connection_id>', methods=['PUT'])
def edit_connection(connection_id):
    success, msg = dao.update_connection(connection_id, request.json['consumer_id'], request.json['area_id'], request.json['type'], request.json['load'], request.json['status'])
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

@app.route('/api/readings', methods=['GET', 'POST'])
def readings():
    if request.method == 'POST':
        result = dao.add_meter_reading(request.json['connection_id'], request.json['billing_month'], request.json['previous_reading'], request.json['current_reading'])
        return jsonify(result), 201 if result['success'] else 400
    return jsonify(dao.get_readings())

@app.route('/api/readings/<int:reading_id>', methods=['PUT', 'DELETE'])
def modify_reading(reading_id):
    if request.method == 'DELETE':
        success, msg = dao.delete_meter_reading(reading_id)
        return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400
    elif request.method == 'PUT':
        success, msg = dao.update_meter_reading(reading_id, request.json['previous_reading'], request.json['current_reading'])
        return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

@app.route('/api/bills', methods=['GET'])
def get_bills(): return jsonify(dao.get_bills())

@app.route('/api/admin/bills/<int:bill_id>/status', methods=['PUT'])
def admin_update_bill_status(bill_id):
    success, msg = dao.update_bill_status_admin(bill_id, request.json.get('status'), request.json.get('method'))
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

@app.route('/api/bills/<int:bill_id>/invoice', methods=['GET'])
def get_invoice(bill_id):
    data = dao.get_full_invoice_details(bill_id)
    return jsonify(data), 200 if data else 404

@app.route('/api/bills/<int:bill_id>/pay', methods=['POST'])
def pay_bill(bill_id):
    result = dao.pay_bill_transaction(bill_id)
    return jsonify(result), 200 if result['success'] else 400

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

@app.route('/api/consumer/<int:consumer_id>/tickets', methods=['GET', 'POST'])
def handle_consumer_tickets(consumer_id):
    if request.method == 'POST':
        success, msg = dao.create_ticket(consumer_id, request.json.get('subject'), request.json.get('message'))
        return jsonify({"message": msg}) if success else jsonify({"error": msg}), 201 if success else 400
    return jsonify(dao.get_consumer_tickets(consumer_id)), 200

@app.route('/api/admin/tickets', methods=['GET'])
def admin_get_all_tickets(): return jsonify(dao.get_all_tickets()), 200

@app.route('/api/admin/tickets/<int:ticket_id>/status', methods=['PUT'])
def admin_update_ticket_status(ticket_id):
    success, msg = dao.update_ticket_status(ticket_id, request.json.get('status'), request.json.get('is_satisfied'))
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

@app.route('/api/tickets/<int:ticket_id>/replies', methods=['GET'])
def get_ticket_conversation(ticket_id):
    thread_data = dao.get_ticket_thread(ticket_id)
    return jsonify(thread_data), 200 if thread_data else 404

@app.route('/api/tickets/<int:ticket_id>/reply', methods=['POST'])
def post_ticket_reply(ticket_id):
    success, msg = dao.add_ticket_reply(ticket_id, request.json.get('senderRole'), request.json.get('message'))
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 201 if success else 400

@app.route('/api/delete/<table_name>/<int:record_id>', methods=['DELETE'])
def delete_record(table_name, record_id):
    pk_map = {'power_grid': 'grid_id', 'distribution_area': 'area_id', 'consumer': 'consumer_id', 'connection': 'connection_id'}
    success, msg = dao.delete_record(table_name, pk_map.get(table_name), record_id)
    return jsonify({"message": msg}) if success else jsonify({"error": msg}), 200 if success else 400

if __name__ == '__main__':
    init_database()
    app.run(debug=True, port=5000)