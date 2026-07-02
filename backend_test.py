#!/usr/bin/env python3
"""
Backend Test Suite - Bug Fix Verification
Testing product search functionality after bug fix
"""

import requests
import json
import sys

# Backend URL from environment
BACKEND_URL = "https://calc-flow-sync.preview.emergentagent.com/api"

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print(f"{'='*60}")

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    return success

def test_create_product():
    """Test 1: Create a new product manually"""
    print_test_header("Create New Product")
    
    product_data = {
        "nombre": "CLAVO DE ACERO 2 PULGADAS",
        "costo": 50,
        "precio_venta": 75
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/productos",
            json=product_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 200:
            data = response.json()
            product_id = data.get("id")
            print(f"Product created with ID: {product_id}")
            return print_result(True, f"Product created successfully (ID: {product_id})"), product_id
        else:
            return print_result(False, f"Failed to create product: {response.status_code} - {response.text}"), None
            
    except Exception as e:
        return print_result(False, f"Exception during product creation: {str(e)}"), None

def test_search_uppercase(product_name_part):
    """Test 2: Search with uppercase query"""
    print_test_header(f"Search Product - Uppercase Query: '{product_name_part}'")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/productos/buscar",
            params={"q": product_name_part},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Response: {response.text[:500]}")
            return print_result(False, f"Search failed with status {response.status_code}")
        
        results = response.json()
        print(f"Found {len(results)} results")
        
        # Check if our product is in results
        found = False
        for product in results:
            if "CLAVO DE ACERO 2 PULGADAS" in product.get("nombre", ""):
                found = True
                print(f"✓ Found product: {product.get('nombre')}")
                break
        
        if found:
            return print_result(True, f"Product found in search results for '{product_name_part}'")
        else:
            print(f"Products found: {[p.get('nombre') for p in results[:5]]}")
            return print_result(False, f"Product NOT found in search results for '{product_name_part}'")
            
    except Exception as e:
        return print_result(False, f"Exception during search: {str(e)}")

def test_search_lowercase(product_name_part):
    """Test 3: Search with lowercase query (case-insensitive test)"""
    print_test_header(f"Search Product - Lowercase Query: '{product_name_part}'")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/productos/buscar",
            params={"q": product_name_part},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Response: {response.text[:500]}")
            return print_result(False, f"Search failed with status {response.status_code}")
        
        results = response.json()
        print(f"Found {len(results)} results")
        
        # Check if our product is in results
        found = False
        for product in results:
            if "CLAVO DE ACERO 2 PULGADAS" in product.get("nombre", ""):
                found = True
                print(f"✓ Found product: {product.get('nombre')}")
                break
        
        if found:
            return print_result(True, f"Case-insensitive search working - product found for '{product_name_part}'")
        else:
            print(f"Products found: {[p.get('nombre') for p in results[:5]]}")
            return print_result(False, f"Product NOT found in search results for '{product_name_part}'")
            
    except Exception as e:
        return print_result(False, f"Exception during search: {str(e)}")

def test_search_multi_word(query):
    """Test 4: Search with multiple words"""
    print_test_header(f"Search Product - Multi-word Query: '{query}'")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/productos/buscar",
            params={"q": query},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Response: {response.text[:500]}")
            return print_result(False, f"Search failed with status {response.status_code}")
        
        results = response.json()
        print(f"Found {len(results)} results")
        
        # Check if our product is in results
        found = False
        for product in results:
            if "CLAVO DE ACERO 2 PULGADAS" in product.get("nombre", ""):
                found = True
                print(f"✓ Found product: {product.get('nombre')}")
                break
        
        if found:
            return print_result(True, f"Multi-word search working - product found for '{query}'")
        else:
            print(f"Products found: {[p.get('nombre') for p in results[:5]]}")
            return print_result(False, f"Product NOT found in search results for '{query}'")
            
    except Exception as e:
        return print_result(False, f"Exception during search: {str(e)}")

def test_product_in_list(product_id):
    """Test 5: Verify product appears in general product list"""
    print_test_header("Verify Product in General List")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/productos",
            params={"limit": 10000},  # Get many products to ensure we find it
            timeout=15
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            return print_result(False, f"Failed to get product list: {response.status_code}")
        
        products = response.json()
        print(f"Total products in list: {len(products)}")
        
        # Look for our product
        found = False
        for product in products:
            if product.get("id") == product_id or "CLAVO DE ACERO 2 PULGADAS" in product.get("nombre", ""):
                found = True
                print(f"✓ Found product in list: {product.get('nombre')} (ID: {product.get('id')})")
                break
        
        if found:
            return print_result(True, "Product appears in general product list")
        else:
            return print_result(False, "Product NOT found in general product list")
            
    except Exception as e:
        return print_result(False, f"Exception during list retrieval: {str(e)}")

def cleanup_test_product(product_id):
    """Cleanup: Delete the test product"""
    print_test_header("Cleanup - Delete Test Product")
    
    if not product_id:
        print("⚠️  No product ID to cleanup")
        return
    
    try:
        response = requests.delete(
            f"{BACKEND_URL}/productos/{product_id}",
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print(f"✓ Test product deleted successfully")
        else:
            print(f"⚠️  Could not delete test product: {response.text}")
            
    except Exception as e:
        print(f"⚠️  Exception during cleanup: {str(e)}")

def main():
    print("\n" + "="*60)
    print("BUG FIX VERIFICATION - Product Search Functionality")
    print("="*60)
    print(f"Backend URL: {BACKEND_URL}")
    print("="*60)
    
    results = []
    product_id = None
    
    # Test 1: Create product
    success, product_id = test_create_product()
    results.append(("Create Product", success))
    
    if not success:
        print("\n❌ Cannot continue testing - product creation failed")
        sys.exit(1)
    
    # Test 2: Search with uppercase
    success = test_search_uppercase("CLAVO")
    results.append(("Search Uppercase 'CLAVO'", success))
    
    # Test 3: Search with lowercase (case-insensitive)
    success = test_search_lowercase("acero")
    results.append(("Search Lowercase 'acero'", success))
    
    # Test 4: Search with multiple words
    success = test_search_multi_word("clavo acero")
    results.append(("Search Multi-word 'clavo acero'", success))
    
    # Test 5: Verify in product list
    success = test_product_in_list(product_id)
    results.append(("Product in List", success))
    
    # Cleanup
    cleanup_test_product(product_id)
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Bug fix verified successfully!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed - Bug fix needs attention")
        sys.exit(1)

if __name__ == "__main__":
    main()
