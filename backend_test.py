#!/usr/bin/env python3
"""
Backend API Testing for Spanish Calculator App - Flujos CRUD Operations
Tests the specific endpoints requested in the review request
"""

import requests
import json
import sys
from datetime import datetime

# Configuration - Use the specific URL from the review request
BASE_URL = "https://calc-mobile-app-1.preview.emergentagent.com/api"

class FlujosAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.created_flow_id = None
        
    def log(self, message):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {message}")
        
    def test_get_flujos_initial(self):
        """Test 1: GET /api/flujos - Get initial flows"""
        self.log("Testing GET /api/flujos - Get initial flows")
        try:
            response = self.session.get(f"{self.base_url}/flujos")
            response.raise_for_status()
            
            flows = response.json()
            self.log(f"✅ GET /api/flujos successful - Found {len(flows)} existing flows")
            
            for i, flow in enumerate(flows[:3]):  # Show first 3 flows
                self.log(f"   Flow {i+1}: {flow.get('nombre', 'No name')} (ID: {flow.get('_id', 'No ID')})")
            
            return True, flows
            
        except requests.exceptions.RequestException as e:
            self.log(f"❌ GET /api/flujos failed - Error: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                self.log(f"   Response status: {e.response.status_code}")
                self.log(f"   Response body: {e.response.text}")
            return False, None
            
    def test_create_flujo(self):
        """Test 2: POST /api/flujos - Create new flow"""
        self.log("Testing POST /api/flujos - Create new flow")
        
        # Test data as specified in the request
        test_flow = {
            "nombre": "Flujo de Prueba",
            "operaciones": [
                {
                    "nombre": "Operacion Test",
                    "tipo_operacion": "Sumar",
                    "tipo_valor": "Porcentaje",
                    "orden": 0
                }
            ]
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/flujos",
                data=json.dumps(test_flow)
            )
            response.raise_for_status()
            
            created_flow = response.json()
            self.created_flow_id = created_flow.get('_id')
            
            self.log(f"✅ POST /api/flujos successful - Created flow with ID: {self.created_flow_id}")
            self.log(f"   Flow name: {created_flow.get('nombre')}")
            self.log(f"   Operations count: {len(created_flow.get('operaciones', []))}")
            
            return True, created_flow
            
        except requests.exceptions.RequestException as e:
            self.log(f"❌ POST /api/flujos failed - Error: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                self.log(f"   Response status: {e.response.status_code}")
                self.log(f"   Response body: {e.response.text}")
            return False, None
            
    def test_verify_created_flujo(self):
        """Test 3: GET /api/flujos - Verify the new flow appears"""
        self.log("Testing GET /api/flujos - Verify new flow appears")
        
        try:
            response = self.session.get(f"{self.base_url}/flujos")
            response.raise_for_status()
            
            flows = response.json()
            
            # Look for our created flow
            created_flow_found = None
            for flow in flows:
                if flow.get('_id') == self.created_flow_id:
                    created_flow_found = flow
                    break
            
            if created_flow_found:
                self.log(f"✅ GET /api/flujos verification successful - New flow found in list")
                self.log(f"   Flow name: {created_flow_found.get('nombre')}")
                self.log(f"   Flow ID: {created_flow_found.get('_id')}")
                return True, created_flow_found
            else:
                self.log(f"❌ GET /api/flujos verification failed - New flow not found in list")
                self.log(f"   Looking for ID: {self.created_flow_id}")
                self.log(f"   Total flows in list: {len(flows)}")
                return False, None
                
        except requests.exceptions.RequestException as e:
            self.log(f"❌ GET /api/flujos verification failed - Error: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                self.log(f"   Response status: {e.response.status_code}")
                self.log(f"   Response body: {e.response.text}")
            return False, None
            
    def test_delete_flujo(self):
        """Test 4: DELETE /api/flujos/{id} - Delete the test flow"""
        if not self.created_flow_id:
            self.log("❌ DELETE test skipped - No flow ID available")
            return False, None
            
        self.log(f"Testing DELETE /api/flujos/{self.created_flow_id} - Delete test flow")
        
        try:
            response = self.session.delete(f"{self.base_url}/flujos/{self.created_flow_id}")
            response.raise_for_status()
            
            delete_result = response.json()
            self.log(f"✅ DELETE /api/flujos/{self.created_flow_id} successful")
            self.log(f"   Response: {delete_result.get('message', 'No message')}")
            
            return True, delete_result
            
        except requests.exceptions.RequestException as e:
            self.log(f"❌ DELETE /api/flujos/{self.created_flow_id} failed - Error: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                self.log(f"   Response status: {e.response.status_code}")
                self.log(f"   Response body: {e.response.text}")
            return False, None

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