#!/usr/bin/env python3
"""
Backend Testing Suite for Calculadora de Precios Móvil
Tests all backend endpoints as requested in the review.
"""

import requests
import json
import sys
from datetime import datetime

# Get backend URL from frontend .env
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    return line.split('=')[1].strip()
    except Exception as e:
        print(f"Error reading frontend .env: {e}")
        return None

BACKEND_URL = get_backend_url()
if not BACKEND_URL:
    print("❌ Could not get backend URL from frontend/.env")
    sys.exit(1)

API_BASE = f"{BACKEND_URL}/api"
print(f"🔗 Testing backend at: {API_BASE}")

def test_health():
    """Test if backend is running"""
    print("\n=== HEALTH CHECK ===")
    try:
        response = requests.get(f"{API_BASE}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Backend health: {data}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_productos():
    """Test productos endpoints"""
    print("\n=== TESTING PRODUCTOS ===")
    
    # Test GET /api/productos
    try:
        print("Testing GET /api/productos...")
        response = requests.get(f"{API_BASE}/productos", timeout=10)
        if response.status_code == 200:
            productos = response.json()
            count = len(productos)
            print(f"✅ GET /api/productos: {count} productos returned")
            
            # Check if we have around 4349 products as expected
            if count > 4000:
                print(f"✅ Product count looks good: {count} (expected ~4349)")
            elif count > 0:
                print(f"⚠️  Product count lower than expected: {count} (expected ~4349)")
            else:
                print(f"❌ No products found")
                return False
                
            return True
        else:
            print(f"❌ GET /api/productos failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error testing productos: {e}")
        return False

def test_productos_buscar():
    """Test product search"""
    print("\n=== TESTING PRODUCT SEARCH ===")
    
    try:
        print("Testing GET /api/productos/buscar?q=ABANICO...")
        response = requests.get(f"{API_BASE}/productos/buscar?q=ABANICO", timeout=10)
        if response.status_code == 200:
            productos = response.json()
            count = len(productos)
            print(f"✅ Product search: {count} results for 'ABANICO'")
            
            if count > 0:
                print(f"✅ Search working - found products containing 'ABANICO'")
                # Show first result as example
                if productos:
                    print(f"   Example: {productos[0].get('nombre', 'N/A')}")
            else:
                print(f"⚠️  No products found for 'ABANICO' - this might be expected")
            
            return True
        else:
            print(f"❌ Product search failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error testing product search: {e}")
        return False

def test_flujos():
    """Test flujos endpoints"""
    print("\n=== TESTING FLUJOS ===")
    
    try:
        print("Testing GET /api/flujos...")
        response = requests.get(f"{API_BASE}/flujos", timeout=10)
        if response.status_code == 200:
            flujos = response.json()
            count = len(flujos)
            print(f"✅ GET /api/flujos: {count} flujos returned")
            
            # Look for "Cálculo con IVA" flow
            iva_flow = None
            for flujo in flujos:
                if "IVA" in flujo.get("nombre", "").upper():
                    iva_flow = flujo
                    break
            
            if iva_flow:
                print(f"✅ Found IVA flow: {iva_flow['nombre']}")
                print(f"   Flow ID: {iva_flow.get('_id')}")
                return True, iva_flow.get('_id')
            else:
                print(f"⚠️  Expected 'Cálculo con IVA' flow not found")
                if flujos:
                    print(f"   Available flows: {[f.get('nombre') for f in flujos]}")
                return True, flujos[0].get('_id') if flujos else None
                
        else:
            print(f"❌ GET /api/flujos failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False, None
    except Exception as e:
        print(f"❌ Error testing flujos: {e}")
        return False, None

def test_calcular(flujo_id):
    """Test price calculation endpoint"""
    print("\n=== TESTING PRICE CALCULATION ===")
    
    if not flujo_id:
        print("❌ No flujo_id available for testing")
        return False
    
    # Test payload as specified in the review request
    payload = {
        "costo_base": 10000,
        "flujo_id": flujo_id,
        "valores_operaciones": {
            "IVA": 19,
            "Descuento mayorista": 10
        },
        "clientes": [
            {
                "nombre": "Cliente 1", 
                "porcentaje_ganancia": 20, 
                "comentario": "Mayorista"
            }
        ]
    }
    
    try:
        print(f"Testing POST /api/calcular with flujo_id: {flujo_id}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(
            f"{API_BASE}/calcular", 
            json=payload, 
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Price calculation successful!")
            print(f"   Costo base calculado: {result.get('costo_base')}")
            print(f"   Resultados: {json.dumps(result.get('resultados'), indent=2)}")
            return True, result
        else:
            print(f"❌ Price calculation failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False, None
            
    except Exception as e:
        print(f"❌ Error testing price calculation: {e}")
        return False, None

def test_guardar_calculo():
    """Test saving calculation"""
    print("\n=== TESTING SAVE CALCULATION ===")
    
    # Sample calculation data
    calculo_data = {
        "nombre_producto": "Producto Test",
        "flujo_nombre": "Flujo Test",
        "flujo_id": "test_flujo_id",
        "valores_operaciones": {
            "IVA": 19,
            "Descuento": 10
        },
        "clientes": [
            {
                "nombre": "Cliente Test",
                "porcentaje_ganancia": 20,
                "comentario": "Cliente de prueba",
                "precio_final": 12000
            }
        ],
        "costo_base": 10000
    }
    
    try:
        print("Testing POST /api/calculos...")
        response = requests.post(
            f"{API_BASE}/calculos",
            json=calculo_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Calculation saved successfully!")
            print(f"   Saved calculation ID: {result.get('_id')}")
            return True, result.get('_id')
        else:
            print(f"❌ Save calculation failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False, None
            
    except Exception as e:
        print(f"❌ Error saving calculation: {e}")
        return False, None

def test_cotizaciones():
    """Test quotations endpoint"""
    print("\n=== TESTING COTIZACIONES ===")
    
    # Sample quotation data
    cotizacion_data = {
        "nombre_cliente": "Cliente Ejemplo",
        "items": [
            {
                "cantidad": 2,
                "producto_id": "test_producto_id",
                "nombre_producto": "Producto Ejemplo",
                "precio_unitario": 15000,
                "subtotal": 30000
            }
        ],
        "total": 30000
    }
    
    try:
        print("Testing POST /api/cotizaciones...")
        response = requests.post(
            f"{API_BASE}/cotizaciones",
            json=cotizacion_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Quotation created successfully!")
            print(f"   Quotation ID: {result.get('_id')}")
            print(f"   Cliente: {result.get('nombre_cliente')}")
            print(f"   Total: {result.get('total')}")
            return True
        else:
            print(f"❌ Create quotation failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing quotations: {e}")
        return False

def main():
    """Run all backend tests"""
    print("🚀 Starting Backend Testing Suite")
    print("=" * 50)
    
    results = {}
    
    # Test 1: Health check
    results['health'] = test_health()
    if not results['health']:
        print("\n❌ Backend is not responding. Stopping tests.")
        return
    
    # Test 2: Productos
    results['productos'] = test_productos()
    
    # Test 3: Product search
    results['productos_buscar'] = test_productos_buscar()
    
    # Test 4: Flujos
    flujos_success, flujo_id = test_flujos()
    results['flujos'] = flujos_success
    
    # Test 5: Price calculation
    if flujo_id:
        calcular_success, calc_result = test_calcular(flujo_id)
        results['calcular'] = calcular_success
    else:
        print("\n⚠️  Skipping price calculation test - no flujo_id available")
        results['calcular'] = False
    
    # Test 6: Save calculation
    guardar_success, calc_id = test_guardar_calculo()
    results['guardar_calculo'] = guardar_success
    
    # Test 7: Quotations
    results['cotizaciones'] = test_cotizaciones()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for success in results.values() if success)
    total = len(results)
    
    for test_name, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{test_name:20} {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All backend tests PASSED!")
        return True
    else:
        print("⚠️  Some tests failed. Check details above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)