from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import dao
import user_dao 

app = Flask(__name__)
CORS(app)

# ==========================================
# --- AUTH ROUTES (Login & Signup) ---
# ==========================================
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    full_name = data.get('fullname')
    username = data.get('username')
    password = data.get('password')

    if not all([full_name, username, password]):
        return jsonify({"error": "Missing data"}), 400

    hashed_password = generate_password_hash(password)
    success, message = user_dao.create_user(full_name, username, hashed_password)

    if success:
        return jsonify({"message": message}), 201
    elif "exists" in message:
        return jsonify({"error": message}), 409
    else:
        return jsonify({"error": message}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
         return jsonify({"error": "Missing credentials"}), 400

    stored_hash = user_dao.get_user_password_hash(username)

    if stored_hash and check_password_hash(stored_hash, password):
        return jsonify({"message": "Login successful"}), 200
    else:
        return jsonify({"error": "Invalid username or password"}), 401


# ==========================================
# --- DATA FETCH ROUTES (Dashboard) ---
# ==========================================
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
def get_analytics():
    return jsonify({
        "top_areas": dao.get_analytics_top_areas(),
        "power_loss": dao.get_analytics_power_loss()
    })


# ==========================================
# --- DELETE ROUTES ---
# ==========================================
@app.route('/api/delete/<table_name>/<int:record_id>', methods=['DELETE'])
def delete_record(table_name, record_id):
    pk_map = {
        'power_grid': 'grid_id',
        'distribution_area': 'area_id',
        'consumer': 'consumer_id',
        'connection': 'connection_id'
    }
    
    if table_name not in pk_map:
        return jsonify({"error": "Invalid table"}), 400
        
    success, msg = dao.delete_record(table_name, pk_map[table_name], record_id)
    if success: return jsonify({"message": "Deleted successfully"}), 200
    return jsonify({"error": msg}), 500


# ==========================================
# --- ADD ROUTES ---
# ==========================================
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


if __name__ == '__main__':
    app.run(debug=True, port=5000)