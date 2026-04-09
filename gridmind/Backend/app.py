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
    username = data.get('username')
    login_type = data.get('loginType')
    password = data.get('password')

    # 1. Fetch user and check lock status
    user_data = dao.check_and_get_user(username, login_type)
    
    if not user_data:
        dao.log_login_attempt(username, login_type, "Failed - Bad Username")
        return jsonify({"error": "Invalid username or password"}), 401

    if user_data.get('is_locked'):
        time_left = user_data.get('time_left', '30m 0s') # Get the dynamic time
        dao.log_login_attempt(username, login_type, "Failed - Locked Out")
        return jsonify({"error": f"Account is locked. Please try again in {time_left}."}), 403
    
    # 2. Check Password
    if check_password_hash(user_data['password_hash'], password):
        dao.handle_successful_login(username, login_type)
        dao.log_login_attempt(username, login_type, "Success")
        return jsonify({
            "message": "Login successful", 
            "role": user_data['role'], 
            "consumer_id": user_data.get('consumer_id')
        }), 200
    else:
        # 3. Wrong Password -> Handle Failures
        just_locked = dao.handle_failed_login(username, login_type)
        if just_locked:
            dao.log_login_attempt(username, login_type, "Account Locked (5 fails)")
            return jsonify({"error": "Account locked due to 5 failed attempts. Please wait 30 minutes."}), 403
        else:
            dao.log_login_attempt(username, login_type, "Failed - Bad Password")
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
        raw_password = data['password'] # Capture raw password for the email
        pw_hash = generate_password_hash(raw_password)
        email = data.get('email') # Get the email
        
        # Pass the email to the DAO
        success, msg = dao.add_consumer(
            data['id'], data['name'], data['address'], data['age'], data['username'], pw_hash, email
        )
        
        if success:
            # --- THE SIMULATED WELCOME EMAIL ---
            print("\n" + "="*45)
            print("📩 SIMULATED WELCOME EMAIL DISPATCH")
            print(f"To: {email}")
            print(f"Subject: Welcome to Smart Power!")
            print(f"Hello {data['name']},")
            print(f"Your account has been created by the Grid Admin.")
            print(f"Username: {data['username']}")
            print(f"Password: {raw_password}")
            print("Please log in and update your profile if needed.")
            print("="*45 + "\n")
            
            return jsonify({"message": msg}), 201
        else:
            return jsonify({"error": msg}), 400
            
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

@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    data = request.json
    email = data.get('email')
    login_type = data.get('loginType', 'consumer') # Default to consumer
    
    otp = dao.generate_reset_token(email, login_type)
    
    if otp:
        # --- THE SIMULATED EMAIL ---
        print("\n" + "="*45)
        print("📩 SIMULATED EMAIL DISPATCH")
        print(f"To: {email}")
        print(f"Subject: Smart Power - Password Reset Request")
        print(f"Body: Your 6-digit OTP is: {otp}")
        print("This code will expire in 15 minutes.")
        print("="*45 + "\n")
        
    # Security Best Practice: Always return the same message so attackers can't guess valid emails
    return jsonify({"message": "If the email exists in our system, an OTP has been sent."}), 200

@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    email = data.get('email')
    token = data.get('token')
    new_password = data.get('newPassword')
    login_type = data.get('loginType', 'consumer')
    
    hashed_pw = generate_password_hash(new_password)
    success, msg = dao.reset_password_with_token(email, token, hashed_pw, login_type)
    
    if success:
        return jsonify({"message": msg}), 200
    else:
        return jsonify({"error": msg}), 400
    
@app.route('/api/admin/bills/<int:bill_id>/status', methods=['PUT'])
def admin_update_bill_status(bill_id):
    data = request.json
    status = data.get('status')
    method = data.get('method') # Will be None if reverting to Unpaid
    
    success, msg = dao.update_bill_status_admin(bill_id, status, method)
    if success:
        return jsonify({"message": msg}), 200
    else:
        return jsonify({"error": msg}), 400
    
@app.route('/api/bills/<int:bill_id>/invoice', methods=['GET'])
def get_invoice(bill_id):
    data = dao.get_full_invoice_details(bill_id)
    if data: 
        return jsonify(data), 200
    return jsonify({"error": "Invoice data not found"}), 404

if __name__ == '__main__':
    init_database()
    app.run(debug=True, port=5000)